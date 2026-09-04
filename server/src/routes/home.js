import { Router } from 'express';
import { all, get } from '../db/index.js';

const router = Router();

/**
 * The home page feed.
 *
 * Counts and the most recent things you filed -- enough to see the cabinet has
 * contents and get back into whatever you were last working on. No performance
 * metrics, by design.
 */
router.get('/', (req, res) => {
  res.json({
    counts: {
      days: get('SELECT COUNT(*) AS n FROM trading_session')?.n ?? 0,
      days_reviewed: get("SELECT COUNT(*) AS n FROM trading_session WHERE status = 'REVIEWED'")?.n ?? 0,
      folders: get('SELECT COUNT(*) AS n FROM level_folder WHERE archived = 0')?.n ?? 0,
      level_examples: get('SELECT COUNT(*) AS n FROM level_example')?.n ?? 0,
      categories: get('SELECT COUNT(*) AS n FROM example_category WHERE archived = 0')?.n ?? 0,
      market_examples: get('SELECT COUNT(*) AS n FROM market_example')?.n ?? 0,
      screenshots: get('SELECT COUNT(*) AS n FROM screenshot')?.n ?? 0,
    },

    recent_level_examples: all(
      `SELECT e.id, e.occurred_on, e.instrument, e.timeframe, e.level_price, e.result,
              e.touch_number, e.drawdown, e.reaction,
              f.name AS folder_name, f.slug AS folder_slug,
         (SELECT filename FROM screenshot s WHERE s.entity_type = 'LEVEL_EXAMPLE'
           AND s.entity_id = e.id ORDER BY s.sort_order LIMIT 1) AS thumb
       FROM level_example e JOIN level_folder f ON f.id = e.folder_id
       ORDER BY e.created_at DESC LIMIT 8`
    ),

    recent_market_examples: all(
      `SELECT m.id, m.title, m.occurred_on, m.instrument, m.timeframe,
              c.name AS category_name, c.slug AS category_slug,
         (SELECT filename FROM screenshot s WHERE s.entity_type = 'MARKET_EXAMPLE'
           AND s.entity_id = m.id ORDER BY s.sort_order LIMIT 1) AS thumb
       FROM market_example m JOIN example_category c ON c.id = m.category_id
       ORDER BY m.created_at DESC LIMIT 8`
    ),

    recent_days: all(
      `SELECT s.id, s.date, s.instrument, s.timeframe, s.title, s.status,
              p.expected_day_type, p.locked_at, r.actual_day_type,
         (SELECT COUNT(*) FROM level_example e WHERE e.session_id = s.id)  AS level_count,
         (SELECT COUNT(*) FROM market_example m WHERE m.session_id = s.id) AS example_count,
         (SELECT filename FROM screenshot sc WHERE sc.session_id = s.id
           ORDER BY sc.created_at LIMIT 1) AS thumb
       FROM trading_session s
       LEFT JOIN day_prediction p ON p.session_id = s.id
       LEFT JOIN day_review r ON r.session_id = s.id
       ORDER BY s.date DESC, s.created_at DESC LIMIT 6`
    ),
  });
});

export default router;
