import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { UPLOAD_DIR, all, get, insert, newId, nowIso, run, update } from '../db/index.js';

const router = Router();

/**
 * The certified level database.
 *
 * One row per price level you have backtested and reached a verdict on. There
 * is no aggregation engine here on purpose: you do the research, you decide the
 * numbers, this stores the verdict and the charts that back it up.
 */

const FIELDS = [
  'level_price', 'instrument', 'source', 'timeframe', 'period_tested', 'direction',
  'first_touch_pct', 'first_touch_note',
  'buy_avg_stop', 'buy_avg_profit', 'buy_best_profit',
  'sell_avg_stop', 'sell_avg_profit', 'sell_best_profit',
  'classification', 'importance', 'sample_size', 'notes', 'session_id',
];

const shotsFor = (id) =>
  all(
    "SELECT * FROM screenshot WHERE entity_type = 'CERTIFIED_LEVEL' AND entity_id = ? ORDER BY sort_order, created_at",
    [id]
  );

const hydrate = (level) => ({
  ...level,
  screenshots: shotsFor(level.id),
  session: level.session_id
    ? get('SELECT id, date, instrument FROM trading_session WHERE id = ?', [level.session_id])
    : null,
});

const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Only keep fields that belong, and coerce the numeric ones once. */
function clean(body) {
  const out = {};
  for (const f of FIELDS) {
    if (body[f] === undefined) continue;
    if (f === 'sample_size') out[f] = numOrNull(body[f]);
    else if (f.endsWith('_pct') || f.includes('_avg_') || f.includes('_best_') || f === 'level_price') {
      out[f] = numOrNull(body[f]);
    } else out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

// ----------------------------------------------------------------- listing --
router.get('/levels', (req, res) => {
  const { search, instrument, direction, classification, importance, timeframe } = req.query;
  const where = [];
  const params = [];

  if (instrument) { where.push('instrument = ?'); params.push(instrument); }
  if (direction) {
    // Asking for BUY should also surface levels that work both ways.
    if (direction === 'BOTH') { where.push('direction = ?'); params.push('BOTH'); }
    else { where.push("(direction = ? OR direction = 'BOTH')"); params.push(direction); }
  }
  if (classification) { where.push('classification = ?'); params.push(classification); }
  if (importance) { where.push('importance = ?'); params.push(importance); }
  if (timeframe) { where.push('timeframe = ?'); params.push(timeframe); }
  if (search) {
    const q = `%${search}%`;
    where.push('(CAST(level_price AS TEXT) LIKE ? OR source LIKE ? OR instrument LIKE ? OR notes LIKE ?)');
    params.push(q, q, q, q);
  }

  res.json(
    all(
      `SELECT l.*,
        (SELECT filename FROM screenshot s WHERE s.entity_type = 'CERTIFIED_LEVEL'
          AND s.entity_id = l.id ORDER BY s.sort_order LIMIT 1) AS thumb,
        (SELECT COUNT(*) FROM screenshot s WHERE s.entity_type = 'CERTIFIED_LEVEL'
          AND s.entity_id = l.id) AS chart_count
       FROM certified_level l
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY
         CASE l.classification WHEN 'KEY_LEVEL' THEN 0 ELSE 1 END,
         CASE l.importance WHEN 'MAJOR' THEN 0 ELSE 1 END,
         l.created_at DESC`,
      params
    )
  );
});

/** Sources already in use, so the free-text field can autocomplete. */
router.get('/sources', (req, res) => {
  res.json(
    all(
      `SELECT source AS value, COUNT(*) AS n FROM certified_level
       WHERE source IS NOT NULL AND source != '' GROUP BY source ORDER BY n DESC, source`
    )
  );
});

router.get('/levels/:id', (req, res) => {
  const level = get('SELECT * FROM certified_level WHERE id = ?', [req.params.id]);
  if (!level) return res.status(404).json({ error: 'Level not found' });
  res.json(hydrate(level));
});

router.post('/levels', (req, res) => {
  const b = req.body ?? {};
  const price = numOrNull(b.level_price);
  if (price === null) return res.status(400).json({ error: 'A level price is required.' });

  const ts = nowIso();
  const id = newId('lvl');
  insert('certified_level', {
    ...clean(b),
    id,
    level_price: price,
    direction: b.direction ?? 'BOTH',
    created_at: ts,
    updated_at: ts,
  });
  res.status(201).json(hydrate(get('SELECT * FROM certified_level WHERE id = ?', [id])));
});

router.patch('/levels/:id', (req, res) => {
  if (!get('SELECT id FROM certified_level WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Level not found' });
  }
  if (req.body.level_price !== undefined && numOrNull(req.body.level_price) === null) {
    return res.status(400).json({ error: 'A level price is required.' });
  }
  update('certified_level', req.params.id, { ...clean(req.body), updated_at: nowIso() }, [
    ...FIELDS, 'updated_at',
  ]);
  res.json(hydrate(get('SELECT * FROM certified_level WHERE id = ?', [req.params.id])));
});

router.delete('/levels/:id', (req, res) => {
  // Take the charts with it -- rows first, then the files, so a missing file on
  // disk can never leave a dangling row behind.
  const shots = all(
    "SELECT filename FROM screenshot WHERE entity_type = 'CERTIFIED_LEVEL' AND entity_id = ?",
    [req.params.id]
  );
  run("DELETE FROM screenshot WHERE entity_type = 'CERTIFIED_LEVEL' AND entity_id = ?", [req.params.id]);
  run("DELETE FROM entity_tag WHERE entity_type = 'CERTIFIED_LEVEL' AND entity_id = ?", [req.params.id]);
  run('DELETE FROM certified_level WHERE id = ?', [req.params.id]);
  for (const s of shots) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, s.filename)); } catch { /* already gone */ }
  }
  res.json({ ok: true });
});

export default router;
