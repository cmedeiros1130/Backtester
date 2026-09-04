import { Router } from 'express';
import { all } from '../db/index.js';

const router = Router();

/**
 * One search box across the whole cabinet.
 *
 * Matches certified levels, market examples and studied days. A bare number
 * like "503" finds level prices; words like "range" or "key" match the text
 * you wrote and the classifications you assigned.
 */
router.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ query: '', levels: [], market_examples: [], days: [], total: 0 });

  const like = `%${q}%`;
  const limit = Number(req.query.limit ?? 40);

  const levels = all(
    `SELECT l.id, l.level_price, l.instrument, l.timeframe, l.source, l.direction,
            l.classification, l.importance, l.first_touch_pct, l.sample_size, l.notes,
       (SELECT filename FROM screenshot s WHERE s.entity_type = 'CERTIFIED_LEVEL'
         AND s.entity_id = l.id ORDER BY s.sort_order LIMIT 1) AS thumb
     FROM certified_level l
     WHERE CAST(l.level_price AS TEXT) LIKE ?
        OR l.source LIKE ? OR l.instrument LIKE ? OR l.notes LIKE ?
        OR l.first_touch_note LIKE ? OR l.classification LIKE ? OR l.importance LIKE ?
        OR l.direction LIKE ?
     ORDER BY l.created_at DESC LIMIT ?`,
    [like, like, like, like, like, like, like, like, limit]
  );

  const marketExamples = all(
    `SELECT m.id, m.title, m.occurred_on, m.instrument, m.timeframe, m.description,
            c.name AS category_name, c.slug AS category_slug,
       (SELECT filename FROM screenshot s WHERE s.entity_type = 'MARKET_EXAMPLE'
         AND s.entity_id = m.id ORDER BY s.sort_order LIMIT 1) AS thumb
     FROM market_example m
     JOIN example_category c ON c.id = m.category_id
     WHERE c.name LIKE ?
        OR m.title LIKE ? OR m.description LIKE ? OR m.what_i_see LIKE ?
        OR m.what_makes_valid LIKE ? OR m.what_invalidates LIKE ?
        OR m.what_happened_next LIKE ? OR m.what_i_learned LIKE ?
        OR m.instrument LIKE ?
        OR m.id IN (SELECT et.entity_id FROM entity_tag et JOIN tag t ON t.id = et.tag_id
                    WHERE et.entity_type = 'MARKET_EXAMPLE' AND t.name LIKE ?)
     ORDER BY m.occurred_on DESC, m.created_at DESC LIMIT ?`,
    [like, like, like, like, like, like, like, like, like, like, limit]
  );

  const days = all(
    `SELECT s.id, s.date, s.instrument, s.timeframe, s.title, s.status,
            p.expected_day_type, r.actual_day_type
     FROM trading_session s
     LEFT JOIN day_prediction p ON p.session_id = s.id
     LEFT JOIN day_review r ON r.session_id = s.id
     WHERE s.title LIKE ? OR s.notes LIKE ? OR s.instrument LIKE ? OR s.date LIKE ?
        OR p.main_prediction LIKE ? OR p.important_levels LIKE ? OR p.bull_scenario LIKE ?
        OR p.bear_scenario LIKE ? OR p.waiting_for LIKE ? OR p.invalidates LIKE ?
        OR r.right_about LIKE ? OR r.wrong_about LIKE ? OR r.missed LIKE ? OR r.learned LIKE ?
     ORDER BY s.date DESC LIMIT ?`,
    [like, like, like, like, like, like, like, like, like, like, like, like, like, like, limit]
  );

  res.json({
    query: q,
    levels,
    market_examples: marketExamples,
    days,
    total: levels.length + marketExamples.length + days.length,
  });
});

/** Every tag in use, for filter chips and autocomplete. */
router.get('/tags', (req, res) => {
  res.json(
    all(
      `SELECT t.name, COUNT(et.entity_id) AS n
       FROM tag t LEFT JOIN entity_tag et ON et.tag_id = t.id
       GROUP BY t.id ORDER BY n DESC, t.name`
    )
  );
});

export default router;
