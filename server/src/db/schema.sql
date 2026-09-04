-- ============================================================================
-- LevelForge schema
--
-- A filing cabinet for trading research. Four things live here:
--   1. DAILY PREDICTION  - a historical day you predicted, locked, then reviewed
--   2. LEVEL LIBRARY     - certified price levels: what to trust and how to trade it
--   3. MARKET EXAMPLES   - a visual textbook of ranges, trends, candles, structure
--   4. BACKTEST ARCHIVE  - every day studied, and what came out of it
--
-- Screenshots are the point. Everything else is filing.
--
-- Two rules kept from the earlier design because they still earn their place:
--   - A locked prediction is immutable. The server refuses edits.
--   - Nothing is computed from money. There is no P&L column anywhere.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- A studied day. One row per historical session you worked through.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trading_session (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,                  -- YYYY-MM-DD (the historical day)
  instrument TEXT NOT NULL,
  timeframe  TEXT NOT NULL,
  title      TEXT,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT | LOCKED | REVIEWED
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_session_date ON trading_session(date DESC);

-- ---------------------------------------------------------------------------
-- What you thought before you knew. Lockable, and immutable once locked --
-- locked_payload keeps a verbatim JSON copy so the original text survives even
-- a future schema change.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS day_prediction (
  id                TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL UNIQUE REFERENCES trading_session(id) ON DELETE CASCADE,
  expected_day_type TEXT,   -- RANGE|BULL_TREND|BEAR_TREND|REVERSAL|BREAKOUT|UNCLEAR
  bias              TEXT,   -- BULLISH|BEARISH|NEUTRAL
  important_levels  TEXT,
  main_prediction   TEXT,
  bull_scenario     TEXT,
  bear_scenario     TEXT,
  waiting_for       TEXT,
  invalidates       TEXT,
  notes             TEXT,
  locked_at         TEXT,
  locked_payload    TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- What actually happened, and what you took from it. Four questions, no scores.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS day_review (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL UNIQUE REFERENCES trading_session(id) ON DELETE CASCADE,
  actual_day_type TEXT,
  right_about     TEXT,
  wrong_about     TEXT,
  missed          TEXT,
  learned         TEXT,
  notes           TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- LEVEL LIBRARY  --  the certified level database
--
-- One row per PRICE LEVEL you have backtested and decided to trust (or not).
-- This is a certification record, not a filing cabinet: after doing the
-- research elsewhere, you write down the verdict here.
--
-- Every number is in POINTS. There is no money anywhere in this application.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certified_level (
  id               TEXT PRIMARY KEY,

  -- What the level is.
  level_price      REAL NOT NULL,
  instrument       TEXT,
  source           TEXT,      -- free text: "4H Previous Candle Low", anything you like
  timeframe        TEXT,      -- free text: 1m|5m|15m|30m|1h|4h|1D or your own
  period_tested    TEXT,      -- optional, e.g. "Jan-Mar 2026"

  -- How it trades. BUY | SELL | BOTH
  direction        TEXT NOT NULL DEFAULT 'BOTH',

  -- First touch is treated separately because it behaves differently.
  first_touch_pct  REAL,      -- 0-100, entered by hand after backtesting
  first_touch_note TEXT,

  -- Points of room needed, and points typically returned. Buy side.
  buy_avg_stop     REAL,
  buy_avg_profit   REAL,
  buy_best_profit  REAL,

  -- Sell side.
  sell_avg_stop    REAL,
  sell_avg_profit  REAL,
  sell_best_profit REAL,

  -- Two independent verdicts.
  classification   TEXT,      -- KEY_LEVEL | WATCH_OUT_AREA
  importance       TEXT,      -- MAJOR | MINOR

  sample_size      INTEGER,   -- how many occurrences you tested before certifying
  notes            TEXT,

  -- Optional: the studied day this came out of.
  session_id       TEXT REFERENCES trading_session(id) ON DELETE SET NULL,

  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_level_price ON certified_level(level_price);
CREATE INDEX IF NOT EXISTS ix_level_class ON certified_level(classification, importance);
CREATE INDEX IF NOT EXISTS ix_level_session ON certified_level(session_id);

-- ---------------------------------------------------------------------------
-- MARKET EXAMPLES
-- The visual textbook. A category is a chapter; an example is a page.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS example_category (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_example (
  id                 TEXT PRIMARY KEY,
  category_id        TEXT NOT NULL REFERENCES example_category(id) ON DELETE CASCADE,
  session_id         TEXT REFERENCES trading_session(id) ON DELETE SET NULL,

  title              TEXT NOT NULL,
  occurred_on        TEXT,
  instrument         TEXT,
  timeframe          TEXT,
  description        TEXT,
  what_i_see         TEXT,
  what_makes_valid   TEXT,
  what_invalidates   TEXT,
  what_happened_next TEXT,
  what_i_learned     TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mex_category ON market_example(category_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS ix_mex_session ON market_example(session_id);

-- ---------------------------------------------------------------------------
-- Screenshots. The most important table in the application.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screenshot (
  id            TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL,  -- SESSION|DAY_PREDICTION|DAY_REVIEW|CERTIFIED_LEVEL|MARKET_EXAMPLE
  entity_id     TEXT,
  session_id    TEXT REFERENCES trading_session(id) ON DELETE CASCADE,
  category      TEXT,           -- BEFORE|AFTER|ANNOTATED|MAIN|SETUP|RESULT|OTHER
  caption       TEXT,
  filename      TEXT NOT NULL,
  original_name TEXT,
  mime          TEXT,
  size_bytes    INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_shot_entity ON screenshot(entity_type, entity_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_shot_session ON screenshot(session_id);

-- ---------------------------------------------------------------------------
-- Tags. Free-form, shared across level examples and market examples.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tag (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entity_tag (
  tag_id      TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- CERTIFIED_LEVEL | MARKET_EXAMPLE | SESSION
  entity_id   TEXT NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS ix_entity_tag ON entity_tag(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Settings and bookkeeping.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_setting (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ---------------------------------------------------------------------------
-- PRESERVED, NOT SURFACED
--
-- The market-data adapter layer and the replay cursor. These are not part of
-- the four-section product and nothing in the UI reads them, but the import
-- adapters and the future-data guard are intact and still tested, so candle
-- replay can come back later without rebuilding it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_dataset (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  instrument TEXT NOT NULL,
  timeframe  TEXT NOT NULL,
  source     TEXT,
  timezone   TEXT,
  row_count  INTEGER NOT NULL DEFAULT 0,
  first_ts   INTEGER,
  last_ts    INTEGER,
  meta       TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS candle (
  dataset_id TEXT NOT NULL REFERENCES market_dataset(id) ON DELETE CASCADE,
  ts         INTEGER NOT NULL,
  open       REAL NOT NULL,
  high       REAL NOT NULL,
  low        REAL NOT NULL,
  close      REAL NOT NULL,
  volume     REAL,
  PRIMARY KEY (dataset_id, ts)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS backtest_meta (
  session_id   TEXT PRIMARY KEY REFERENCES trading_session(id) ON DELETE CASCADE,
  dataset_id   TEXT REFERENCES market_dataset(id) ON DELETE SET NULL,
  start_ts     INTEGER,
  end_ts       INTEGER,
  warmup_bars  INTEGER NOT NULL DEFAULT 40,
  cursor_index INTEGER NOT NULL DEFAULT 0,
  max_index    INTEGER NOT NULL DEFAULT 0,
  revealed     INTEGER NOT NULL DEFAULT 0,
  speed        REAL NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
