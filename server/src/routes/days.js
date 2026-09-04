import { Router } from 'express';
import { all, get, insert, newId, nowIso, run, update } from '../db/index.js';

const router = Router();

/**
 * A studied day: the prediction you locked, the review you wrote afterwards,
 * and everything you filed from it.
 */

const SESSION_FIELDS = ['date', 'instrument', 'timeframe', 'title', 'notes', 'status'];

const PREDICTION_FIELDS = [
  'expected_day_type', 'bias', 'important_levels', 'main_prediction',
  'bull_scenario', 'bear_scenario', 'waiting_for', 'invalidates', 'notes',
];

const REVIEW_FIELDS = [
  'actual_day_type', 'right_about', 'wrong_about', 'missed', 'learned', 'notes',
];

const shots = (entityType, entityId) =>
  all(
    'SELECT * FROM screenshot WHERE entity_type = ? AND entity_id = ? ORDER BY sort_order, created_at',
    [entityType, entityId]
  );

function bundle(sessionId) {
  const session = get('SELECT * FROM trading_session WHERE id = ?', [sessionId]);
  if (!session) return null;

  const prediction = get('SELECT * FROM day_prediction WHERE session_id = ?', [sessionId]);
  const review = get('SELECT * FROM day_review WHERE session_id = ?', [sessionId]);

  return {
    session,
    prediction: prediction
      ? {
          ...prediction,
          locked_snapshot: prediction.locked_payload ? JSON.parse(prediction.locked_payload) : null,
          screenshots: shots('DAY_PREDICTION', prediction.id),
        }
      : null,
    review: review ? { ...review, screenshots: shots('DAY_REVIEW', review.id) } : null,
    screenshots: shots('SESSION', sessionId),
    // What this day produced. The whole point of studying it.
    levels: all(
      `SELECT l.*,
        (SELECT filename FROM screenshot s WHERE s.entity_type = 'CERTIFIED_LEVEL'
          AND s.entity_id = l.id ORDER BY s.sort_order LIMIT 1) AS thumb
       FROM certified_level l
       WHERE l.session_id = ? ORDER BY l.created_at DESC`,
      [sessionId]
    ),
    market_examples: all(
      `SELECT m.*, c.name AS category_name, c.slug AS category_slug,
        (SELECT filename FROM screenshot s WHERE s.entity_type = 'MARKET_EXAMPLE'
          AND s.entity_id = m.id ORDER BY s.sort_order LIMIT 1) AS thumb
       FROM market_example m JOIN example_category c ON c.id = m.category_id
       WHERE m.session_id = ? ORDER BY m.created_at DESC`,
      [sessionId]
    ),
  };
}

// ---------------------------------------------------------------- listing --
router.get('/', (req, res) => {
  const { status, instrument, search, limit = 300 } = req.query;
  const where = [];
  const params = [];
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (instrument) { where.push('s.instrument = ?'); params.push(instrument); }
  if (search) {
    where.push('(s.title LIKE ? OR s.notes LIKE ? OR s.instrument LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  res.json(
    all(
      `SELECT s.*,
         p.expected_day_type, p.locked_at, p.bias,
         r.actual_day_type, r.completed_at,
         (SELECT COUNT(*) FROM certified_level e WHERE e.session_id = s.id) AS level_count,
         (SELECT COUNT(*) FROM market_example m WHERE m.session_id = s.id) AS example_count,
         (SELECT COUNT(*) FROM screenshot sc WHERE sc.session_id = s.id)   AS screenshot_count,
         (SELECT filename FROM screenshot sc WHERE sc.session_id = s.id
           ORDER BY sc.created_at LIMIT 1)                                 AS thumb
       FROM trading_session s
       LEFT JOIN day_prediction p ON p.session_id = s.id
       LEFT JOIN day_review r ON r.session_id = s.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.date DESC, s.created_at DESC LIMIT ?`,
      [...params, Number(limit)]
    )
  );
});

router.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.date || !b.instrument || !b.timeframe) {
    return res.status(400).json({ error: 'date, instrument and timeframe are required' });
  }
  const id = newId('day');
  const ts = nowIso();
  insert('trading_session', {
    id,
    date: b.date,
    instrument: b.instrument,
    timeframe: b.timeframe,
    title: b.title ?? null,
    notes: b.notes ?? null,
    status: 'DRAFT',
    created_at: ts,
    updated_at: ts,
  });
  res.status(201).json(bundle(id));
});

router.get('/:id', (req, res) => {
  const data = bundle(req.params.id);
  if (!data) return res.status(404).json({ error: 'Day not found' });
  res.json(data);
});

router.patch('/:id', (req, res) => {
  if (!get('SELECT id FROM trading_session WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Day not found' });
  }
  update('trading_session', req.params.id, { ...req.body, updated_at: nowIso() }, [
    ...SESSION_FIELDS, 'updated_at',
  ]);
  res.json(bundle(req.params.id));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM trading_session WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ------------------------------------------------------------ prediction --
router.put('/:id/prediction', (req, res) => {
  const sessionId = req.params.id;
  if (!get('SELECT id FROM trading_session WHERE id = ?', [sessionId])) {
    return res.status(404).json({ error: 'Day not found' });
  }
  const existing = get('SELECT * FROM day_prediction WHERE session_id = ?', [sessionId]);
  const ts = nowIso();

  if (existing) {
    // The lock is the one rule kept from the old design: what you wrote before
    // you knew the outcome has to stay exactly as written.
    if (existing.locked_at) {
      return res.status(409).json({
        error: 'This prediction is locked. What you wrote before you knew the outcome cannot be edited.',
        locked_at: existing.locked_at,
      });
    }
    update('day_prediction', existing.id, { ...req.body, updated_at: ts }, [
      ...PREDICTION_FIELDS, 'updated_at',
    ]);
    return res.json(bundle(sessionId));
  }

  const id = newId('pred');
  const data = { id, session_id: sessionId, created_at: ts, updated_at: ts };
  for (const f of PREDICTION_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
  insert('day_prediction', data);
  res.status(201).json(bundle(sessionId));
});

router.post('/:id/prediction/lock', (req, res) => {
  const sessionId = req.params.id;
  const existing = get('SELECT * FROM day_prediction WHERE session_id = ?', [sessionId]);
  if (!existing) return res.status(404).json({ error: 'Nothing to lock yet' });
  if (existing.locked_at) {
    return res.status(409).json({ error: 'Already locked', locked_at: existing.locked_at });
  }

  const ts = nowIso();
  const snapshot = { locked_at: ts, fields: {} };
  for (const f of PREDICTION_FIELDS) snapshot.fields[f] = existing[f];

  run('UPDATE day_prediction SET locked_at = ?, locked_payload = ?, updated_at = ? WHERE id = ?', [
    ts, JSON.stringify(snapshot), ts, existing.id,
  ]);
  run("UPDATE trading_session SET status = 'LOCKED', updated_at = ? WHERE id = ? AND status = 'DRAFT'", [
    ts, sessionId,
  ]);
  res.json(bundle(sessionId));
});

// ---------------------------------------------------------------- review ---
router.put('/:id/review', (req, res) => {
  const sessionId = req.params.id;
  if (!get('SELECT id FROM trading_session WHERE id = ?', [sessionId])) {
    return res.status(404).json({ error: 'Day not found' });
  }
  const existing = get('SELECT * FROM day_review WHERE session_id = ?', [sessionId]);
  const ts = nowIso();

  if (existing) {
    update('day_review', existing.id, { ...req.body, updated_at: ts }, [...REVIEW_FIELDS, 'updated_at']);
  } else {
    const id = newId('rev');
    const data = { id, session_id: sessionId, created_at: ts, updated_at: ts };
    for (const f of REVIEW_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
    insert('day_review', data);
  }
  run("UPDATE trading_session SET status = 'REVIEWED', updated_at = ? WHERE id = ? AND status != 'REVIEWED'", [
    ts, sessionId,
  ]);
  res.json(bundle(sessionId));
});

export default router;
