import { Router } from 'express';
import multer from 'multer';
import { all, get, insert, newId, nowIso, run, tx, db } from '../db/index.js';
import { parseMarketFile, inferTimeframe, ADAPTERS } from '../lib/marketdata.js';

const router = Router();
const upload = multer({ dest: undefined, storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------
router.get('/adapters', (req, res) => {
  res.json(ADAPTERS.map((a) => ({ id: a.id, name: a.name })));
});

router.get('/datasets', (req, res) => {
  res.json(
    all(`SELECT d.*, (SELECT COUNT(*) FROM backtest_meta b WHERE b.dataset_id = d.id) AS backtest_count
         FROM market_dataset d ORDER BY d.created_at DESC`)
  );
});

router.post('/datasets/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const b = req.body ?? {};
  if (!b.instrument) return res.status(400).json({ error: 'instrument is required' });

  const text = req.file.buffer.toString('utf8');
  let parsed;
  try {
    parsed = parseMarketFile(text, {
      timeZone: b.timezone || 'UTC',
      adapterId: b.adapter || null,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { candles, adapter, headers, skipped } = parsed;
  const timeframe = b.timeframe || inferTimeframe(candles) || '1m';
  const id = newId('ds');
  const ts = nowIso();

  const stmt = db.prepare(
    'INSERT OR REPLACE INTO candle (dataset_id, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  tx(() => {
    insert('market_dataset', {
      id,
      name: b.name || req.file.originalname,
      instrument: b.instrument,
      timeframe,
      source: adapter,
      timezone: b.timezone || 'UTC',
      row_count: candles.length,
      first_ts: candles[0].ts,
      last_ts: candles[candles.length - 1].ts,
      meta: JSON.stringify({ headers, skipped_rows: skipped, original_name: req.file.originalname }),
      created_at: ts,
    });
    for (const c of candles) {
      stmt.run(id, c.ts, c.open, c.high, c.low, c.close, c.volume);
    }
  });

  res.status(201).json({
    dataset: get('SELECT * FROM market_dataset WHERE id = ?', [id]),
    imported: candles.length,
    skipped,
    adapter,
    inferred_timeframe: timeframe,
  });
});

router.delete('/datasets/:id', (req, res) => {
  run('DELETE FROM market_dataset WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/**
 * Trading days available in a dataset, grouped in the dataset's own timezone.
 * Deliberately returns counts and nothing else - no OHLC - so that picking a
 * replay date cannot spoil the replay.
 */
router.get('/datasets/:id/days', (req, res) => {
  const ds = get('SELECT * FROM market_dataset WHERE id = ?', [req.params.id]);
  if (!ds) return res.status(404).json({ error: 'Dataset not found' });
  const rows = all('SELECT ts FROM candle WHERE dataset_id = ? ORDER BY ts ASC', [ds.id]);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ds.timezone || 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const days = new Map();
  for (const r of rows) {
    const day = fmt.format(new Date(r.ts));
    const cur = days.get(day) ?? { date: day, bars: 0, first_ts: r.ts, last_ts: r.ts };
    cur.bars += 1;
    cur.last_ts = r.ts;
    days.set(day, cur);
  }
  res.json([...days.values()].sort((a, b) => b.date.localeCompare(a.date)));
});

// ---------------------------------------------------------------------------
// Replay engine
//
// The cursor lives on the server. The candles endpoint never returns a bar past
// the cursor unless the session has been explicitly revealed. Future data
// cannot leak into the client, so it cannot leak into the analysis.
// ---------------------------------------------------------------------------

function stateOf(sessionId) {
  const meta = get('SELECT * FROM backtest_meta WHERE session_id = ?', [sessionId]);
  if (!meta) return null;
  const dataset = meta.dataset_id ? get('SELECT * FROM market_dataset WHERE id = ?', [meta.dataset_id]) : null;
  const cursorBar = meta.dataset_id
    ? get(
        `SELECT ts FROM candle WHERE dataset_id = ? AND ts >= ? AND ts <= ?
         ORDER BY ts ASC LIMIT 1 OFFSET ?`,
        [meta.dataset_id, meta.start_ts, meta.end_ts, Math.max(0, meta.cursor_index - 1)]
      )
    : null;
  return {
    ...meta,
    dataset,
    replay_ts: cursorBar ? new Date(cursorBar.ts).toISOString() : null,
    at_end: meta.cursor_index >= meta.max_index,
    progress_pct: meta.max_index ? Math.round((meta.cursor_index / meta.max_index) * 100) : 0,
  };
}

router.post('/backtest/:sessionId/setup', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = get('SELECT * FROM trading_session WHERE id = ?', [sessionId]);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const b = req.body ?? {};
  const ds = get('SELECT * FROM market_dataset WHERE id = ?', [b.dataset_id]);
  if (!ds) return res.status(400).json({ error: 'dataset_id is required and must exist' });

  let startTs = b.start_ts;
  let endTs = b.end_ts;
  if (b.date) {
    // Resolve a calendar day into a bar range using the dataset's timezone.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: ds.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const rows = all('SELECT ts FROM candle WHERE dataset_id = ? ORDER BY ts ASC', [ds.id]);
    const matching = rows.filter((r) => fmt.format(new Date(r.ts)) === b.date);
    if (!matching.length) return res.status(400).json({ error: `No bars found for ${b.date} in this dataset` });
    startTs = matching[0].ts;
    endTs = matching[matching.length - 1].ts;
  }
  if (startTs == null || endTs == null) {
    return res.status(400).json({ error: 'Provide either a date or an explicit start_ts and end_ts' });
  }

  const maxIndex = get(
    'SELECT COUNT(*) AS n FROM candle WHERE dataset_id = ? AND ts >= ? AND ts <= ?',
    [ds.id, startTs, endTs]
  )?.n ?? 0;
  const warmup = Math.min(Number(b.warmup_bars ?? 20), Math.max(0, maxIndex - 1));
  const ts = nowIso();

  const existing = get('SELECT session_id FROM backtest_meta WHERE session_id = ?', [sessionId]);
  const payload = {
    dataset_id: ds.id,
    start_ts: startTs,
    end_ts: endTs,
    warmup_bars: warmup,
    cursor_index: warmup,
    max_index: maxIndex,
    revealed: 0,
    speed: Number(b.speed ?? 1),
    updated_at: ts,
  };
  if (existing) {
    run(
      `UPDATE backtest_meta SET dataset_id = ?, start_ts = ?, end_ts = ?, warmup_bars = ?,
       cursor_index = ?, max_index = ?, revealed = ?, speed = ?, updated_at = ? WHERE session_id = ?`,
      [payload.dataset_id, payload.start_ts, payload.end_ts, payload.warmup_bars, payload.cursor_index,
       payload.max_index, payload.revealed, payload.speed, ts, sessionId]
    );
  } else {
    insert('backtest_meta', { session_id: sessionId, ...payload, created_at: ts });
  }
  // Arming a replay means the study is under way.
  run(
    `UPDATE trading_session SET status = 'IN_PROGRESS', updated_at = ?
     WHERE id = ? AND status = 'DRAFT'`,
    [ts, sessionId]
  );
  res.json(stateOf(sessionId));
});

router.get('/backtest/:sessionId/state', (req, res) => {
  const state = stateOf(req.params.sessionId);
  if (!state) return res.status(404).json({ error: 'No replay configured for this session' });
  res.json(state);
});

/**
 * Visible candles only.
 *
 * This is the future-data guard. Everything the chart can draw comes through
 * here, and this endpoint physically cannot return a bar the trader has not
 * yet reached.
 */
router.get('/backtest/:sessionId/candles', (req, res) => {
  const meta = get('SELECT * FROM backtest_meta WHERE session_id = ?', [req.params.sessionId]);
  if (!meta) return res.status(404).json({ error: 'No replay configured for this session' });
  if (!meta.dataset_id) return res.json({ candles: [], revealed: false });

  const limit = meta.revealed === 1 ? meta.max_index : meta.cursor_index;
  const candles = limit > 0
    ? all(
        `SELECT ts, open, high, low, close, volume FROM candle
         WHERE dataset_id = ? AND ts >= ? AND ts <= ? ORDER BY ts ASC LIMIT ?`,
        [meta.dataset_id, meta.start_ts, meta.end_ts, limit]
      )
    : [];
  res.json({
    candles,
    revealed: meta.revealed === 1,
    cursor_index: meta.cursor_index,
    max_index: meta.max_index,
    withheld: Math.max(0, meta.max_index - limit),
  });
});

router.post('/backtest/:sessionId/advance', (req, res) => {
  const meta = get('SELECT * FROM backtest_meta WHERE session_id = ?', [req.params.sessionId]);
  if (!meta) return res.status(404).json({ error: 'No replay configured' });
  const bars = Math.max(1, Number(req.body?.bars ?? 1));
  const next = Math.min(meta.max_index, meta.cursor_index + bars);
  run('UPDATE backtest_meta SET cursor_index = ?, updated_at = ? WHERE session_id = ?', [
    next, nowIso(), req.params.sessionId,
  ]);
  res.json(stateOf(req.params.sessionId));
});

/** Jump forward to a wall-clock time. Never backwards - that would be a peek. */
router.post('/backtest/:sessionId/jump', (req, res) => {
  const meta = get('SELECT * FROM backtest_meta WHERE session_id = ?', [req.params.sessionId]);
  if (!meta) return res.status(404).json({ error: 'No replay configured' });
  const target = req.body?.to_ts;
  if (target == null) return res.status(400).json({ error: 'to_ts is required' });
  const n = get(
    'SELECT COUNT(*) AS n FROM candle WHERE dataset_id = ? AND ts >= ? AND ts <= ?',
    [meta.dataset_id, meta.start_ts, Math.min(Number(target), meta.end_ts)]
  )?.n ?? 0;
  const next = Math.max(meta.cursor_index, Math.min(meta.max_index, n));
  run('UPDATE backtest_meta SET cursor_index = ?, updated_at = ? WHERE session_id = ?', [
    next, nowIso(), req.params.sessionId,
  ]);
  res.json(stateOf(req.params.sessionId));
});

router.post('/backtest/:sessionId/speed', (req, res) => {
  run('UPDATE backtest_meta SET speed = ?, updated_at = ? WHERE session_id = ?', [
    Number(req.body?.speed ?? 1), nowIso(), req.params.sessionId,
  ]);
  res.json(stateOf(req.params.sessionId));
});

/**
 * Reset the replay clock. Analysis, levels and trades already recorded are left
 * alone on purpose: they carry a replay_ts and remain valid evidence of what
 * was predicted and when.
 */
router.post('/backtest/:sessionId/reset', (req, res) => {
  const meta = get('SELECT * FROM backtest_meta WHERE session_id = ?', [req.params.sessionId]);
  if (!meta) return res.status(404).json({ error: 'No replay configured' });
  run('UPDATE backtest_meta SET cursor_index = ?, revealed = 0, updated_at = ? WHERE session_id = ?', [
    meta.warmup_bars, nowIso(), req.params.sessionId,
  ]);
  res.json(stateOf(req.params.sessionId));
});

/**
 * Reveal the full session. Irreversible for this run: once the outcome is known
 * every level created afterwards is hindsight, and the level route marks it so.
 */
router.post('/backtest/:sessionId/reveal', (req, res) => {
  const meta = get('SELECT * FROM backtest_meta WHERE session_id = ?', [req.params.sessionId]);
  if (!meta) return res.status(404).json({ error: 'No replay configured' });
  run(
    'UPDATE backtest_meta SET revealed = 1, cursor_index = max_index, updated_at = ? WHERE session_id = ?',
    [nowIso(), req.params.sessionId]
  );
  res.json(stateOf(req.params.sessionId));
});

export default router;
