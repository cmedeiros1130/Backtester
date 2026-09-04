import { Router } from 'express';
import { all, get, nowIso, run } from '../db/index.js';

const router = Router();

const DEFAULTS = {
  default_instrument: 'NQ',
  default_timeframe: '5m',
  market_timezone: 'America/New_York',
};

router.get('/', (req, res) => {
  const rows = all('SELECT key, value FROM app_setting');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ ...DEFAULTS, ...stored });
});

router.put('/', (req, res) => {
  const ts = nowIso();
  for (const [key, value] of Object.entries(req.body ?? {})) {
    run(
      `INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, String(value), ts]
    );
  }
  const rows = all('SELECT key, value FROM app_setting');
  res.json({ ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

export default router;
