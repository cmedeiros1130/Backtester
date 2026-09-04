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
      levels: get('SELECT COUNT(*) AS n FROM certified_level')?.n ?? 0,
      key_levels: get("SELECT COUNT(*) AS n FROM certified_level WHERE classification = 'KEY_LEVEL'")?.n ?? 0,
      categories: get('SELECT COUNT(*) AS n FROM example_category WHERE archived = 0')?.n ?? 0,
      market_examples: get('SELECT COUNT(*) AS n FROM market_example')?.n ?? 0,
      screenshots: get('SELECT COUNT(*) AS n FROM screenshot')?.n ?? 0,
    },

    recent_levels: all(
      `SELECT l.id, l.level_price, l.instrument, l.timeframe, l.source, l.direction,
              l.classification, l.importance, l.first_touch_pct, l.sample_size,
              l.buy_avg_stop, l.buy_avg_profit, l.sell_avg_stop, l.sell_avg_profit,
         (SELECT filename FROM screenshot s WHERE s.entity_type = 'CERTIFIED_LEVEL'
           AND s.entity_id = l.id ORDER BY s.sort_order LIMIT 1) AS thumb
       FROM certified_level l
       ORDER BY l.created_at DESC LIMIT 8`
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
         (SELECT COUNT(*) FROM certified_level e WHERE e.session_id = s.id) AS level_count,
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
