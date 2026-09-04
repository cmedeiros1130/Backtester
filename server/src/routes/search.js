import { Router } from 'express';
import { all } from '../db/index.js';

const router = Router();

/**
 * One search box across the whole cabinet.
 *
 * Matches level examples, market examples and studied days. A bare number like
 * "503" finds level prices; words like "reclaim", "range" or "third touch"
 * match the text you wrote and the tags you attached.
 */
router.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ query: '', level_examples: [], market_examples: [], days: [], total: 0 });

  const like = `%${q}%`;
  // "third touch" should still find touch_number = 3.
  const words = q.toLowerCase().split(/\s+/);
  const ordinal = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4 };
  const touchNumber = words.some((w) => w.startsWith('touch'))
    ? (words.map((w) => ordinal[w]).find(Boolean) ?? null)
    : null;
  const limit = Number(req.query.limit ?? 40);

  const levelExamples = all(
    `SELECT e.id, e.occurred_on, e.instrument, e.timeframe, e.level_price, e.result,
            e.touch_number, e.drawdown, e.reaction, e.what_happened,
            f.name AS folder_name, f.slug AS folder_slug,
       (SELECT filename FROM screenshot s WHERE s.entity_type = 'LEVEL_EXAMPLE'
         AND s.entity_id = e.id ORDER BY s.sort_order LIMIT 1) AS thumb
     FROM level_example e
     JOIN level_folder f ON f.id = e.folder_id
     WHERE f.name LIKE ?
        OR e.what_happened LIKE ? OR e.notes LIKE ?
        OR e.instrument LIKE ? OR e.result LIKE ?
        OR CAST(e.level_price AS TEXT) LIKE ?
        OR (? IS NOT NULL AND e.touch_number = ?)
        OR e.id IN (SELECT et.entity_id FROM entity_tag et JOIN tag t ON t.id = et.tag_id
                    WHERE et.entity_type = 'LEVEL_EXAMPLE' AND t.name LIKE ?)
     ORDER BY e.occurred_on DESC, e.created_at DESC LIMIT ?`,
    [like, like, like, like, like, like, touchNumber, touchNumber, like, limit]
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
    level_examples: levelExamples,
    market_examples: marketExamples,
    days,
    total: levelExamples.length + marketExamples.length + days.length,
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
