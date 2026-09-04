/**
 * Schema migrations.
 *
 * schema.sql only ever CREATEs. Anything that changes an EXISTING table lives
 * here, runs BEFORE the schema, and is guarded by an introspection check so a
 * fresh database, a half-migrated one and an up-to-date one all end the same.
 *
 * The 2026-09 simplification drops several subsystems. Nothing is dropped
 * before its useful content has been carried into the new model.
 */

const STEPS = [];
const step = (id, describe, run) => STEPS.push({ id, describe, run });

const tableExists = (db, name) =>
  db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;

const columns = (db, table) =>
  tableExists(db, table) ? db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name) : [];

const hasColumn = (db, table, col) => columns(db, table).includes(col);

const nowIso = () => new Date().toISOString();
const newId = (p) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'folder';

// ---------------------------------------------------------------------------
// Earlier migrations, kept so a database from any prior version still upgrades.
// ---------------------------------------------------------------------------
step('rename-executed-trade', 'executed_trade -> simulated_trade', (db) => {
  if (tableExists(db, 'executed_trade') && !tableExists(db, 'simulated_trade')) {
    db.exec('ALTER TABLE executed_trade RENAME TO simulated_trade');
    return true;
  }
  return false;
});

step('drop-pnl', 'remove the P&L column', (db) => {
  if (hasColumn(db, 'simulated_trade', 'pnl')) {
    db.exec('ALTER TABLE simulated_trade DROP COLUMN pnl');
    return true;
  }
  return false;
});

step('drop-is-simulated', 'remove is_simulated', (db) => {
  if (hasColumn(db, 'simulated_trade', 'is_simulated')) {
    db.exec('ALTER TABLE simulated_trade DROP COLUMN is_simulated');
    return true;
  }
  return false;
});

step('sessions-are-backtests', 'convert live sessions to backtests', (db) => {
  if (!tableExists(db, 'trading_session') || !hasColumn(db, 'trading_session', 'kind')) return false;
  const n = db.prepare("SELECT COUNT(*) AS n FROM trading_session WHERE kind != 'backtest'").get()?.n ?? 0;
  if (n === 0) return false;
  db.exec("UPDATE trading_session SET kind = 'backtest' WHERE kind != 'backtest'");
  return true;
});

step('playbook-provenance', 'link playbook rules to their study', (db) => {
  let changed = false;
  if (tableExists(db, 'playbook') && !hasColumn(db, 'playbook', 'origin_study_id')) {
    db.exec('ALTER TABLE playbook ADD COLUMN origin_study_id TEXT');
    changed = true;
  }
  for (const col of ['source_study_id', 'evidence_summary']) {
    if (tableExists(db, 'playbook_version') && !hasColumn(db, 'playbook_version', col)) {
      db.exec(`ALTER TABLE playbook_version ADD COLUMN ${col} TEXT`);
      changed = true;
    }
  }
  return changed;
});

step('screenshot-entity-rename', 'screenshot EXECUTED_TRADE -> SIMULATED_TRADE', (db) => {
  if (!tableExists(db, 'screenshot')) return false;
  const n = db.prepare("SELECT COUNT(*) AS n FROM screenshot WHERE entity_type = 'EXECUTED_TRADE'").get()?.n ?? 0;
  if (n === 0) return false;
  db.exec("UPDATE screenshot SET entity_type = 'SIMULATED_TRADE' WHERE entity_type = 'EXECUTED_TRADE'");
  return true;
});

step('drop-learning-mode-setting', 'remove the Learning Mode toggle', (db) => {
  if (!tableExists(db, 'app_setting')) return false;
  const n = db.prepare("SELECT COUNT(*) AS n FROM app_setting WHERE key = 'learning_mode'").get()?.n ?? 0;
  if (n === 0) return false;
  db.exec("DELETE FROM app_setting WHERE key = 'learning_mode'");
  return true;
});

// ---------------------------------------------------------------------------
// 2026-09 simplification: LevelForge becomes a research filing cabinet.
// ---------------------------------------------------------------------------

step('prediction-table', 'morning_analysis -> day_prediction', (db) => {
  if (tableExists(db, 'day_prediction') || !tableExists(db, 'morning_analysis')) return false;
  db.exec('ALTER TABLE morning_analysis RENAME TO day_prediction');
  for (const col of ['important_levels', 'main_prediction', 'bull_scenario', 'bear_scenario', 'invalidates', 'notes']) {
    if (!hasColumn(db, 'day_prediction', col)) db.exec(`ALTER TABLE day_prediction ADD COLUMN ${col} TEXT`);
  }
  const carry = [
    ['main_prediction', 'main_thesis'],
    ['bull_scenario', 'bull_case'],
    ['bear_scenario', 'bear_case'],
    ['invalidates', 'invalidates_thesis'],
    ['important_levels', 'important_context'],
  ];
  for (const [to, from] of carry) {
    if (hasColumn(db, 'day_prediction', from)) {
      db.exec(`UPDATE day_prediction SET ${to} = ${from} WHERE ${to} IS NULL AND ${from} IS NOT NULL`);
    }
  }
  // Day types were a longer list before; fold retired values onto the new set.
  db.exec("UPDATE day_prediction SET expected_day_type = 'BULL_TREND' WHERE expected_day_type = 'TREND'");
  db.exec("UPDATE day_prediction SET expected_day_type = 'UNCLEAR' WHERE expected_day_type IN ('HIGH_VOL','LOW_VOL','UNKNOWN')");
  return true;
});

step('review-table', 'eod_review -> day_review', (db) => {
  if (tableExists(db, 'day_review') || !tableExists(db, 'eod_review')) return false;
  db.exec('ALTER TABLE eod_review RENAME TO day_review');
  for (const col of ['actual_day_type', 'right_about', 'wrong_about', 'missed', 'learned', 'notes']) {
    if (!hasColumn(db, 'day_review', col)) db.exec(`ALTER TABLE day_review ADD COLUMN ${col} TEXT`);
  }
  const carry = [
    ['right_about', 'read_correctly'],
    ['wrong_about', 'read_incorrectly'],
    ['missed', 'unexpected'],
    ['learned', 'learned_about_levels'],
    ['notes', 'freeform'],
  ];
  for (const [to, from] of carry) {
    if (hasColumn(db, 'day_review', from)) {
      db.exec(`UPDATE day_review SET ${to} = ${from} WHERE ${to} IS NULL AND ${from} IS NOT NULL`);
    }
  }
  return true;
});

step('session-status-simplify', 'session status -> DRAFT|LOCKED|REVIEWED', (db) => {
  if (!tableExists(db, 'trading_session')) return false;
  const map = {
    PLANNING: 'DRAFT', BACKTEST: 'DRAFT', IN_PROGRESS: 'DRAFT',
    LIVE: 'DRAFT', REVEALED: 'LOCKED', COMPLETED: 'REVIEWED',
  };
  let changed = false;
  for (const [from, to] of Object.entries(map)) {
    const n = db.prepare('SELECT COUNT(*) AS n FROM trading_session WHERE status = ?').get(from)?.n ?? 0;
    if (n > 0) {
      db.prepare('UPDATE trading_session SET status = ? WHERE status = ?').run(to, from);
      changed = true;
    }
  }
  if (tableExists(db, 'day_prediction')) {
    db.exec(`UPDATE trading_session SET status = 'LOCKED'
             WHERE status = 'DRAFT' AND id IN (
               SELECT session_id FROM day_prediction WHERE locked_at IS NOT NULL)`);
  }
  return changed;
});

step('carry-levels-into-library', 'predictive_level + level_touch -> level_example', (db) => {
  if (!tableExists(db, 'predictive_level')) return false;

  // Create the new tables early so the carry-over has somewhere to land.
  db.exec(`
    CREATE TABLE IF NOT EXISTS level_folder (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS level_example (
      id TEXT PRIMARY KEY, folder_id TEXT NOT NULL, session_id TEXT,
      occurred_on TEXT, instrument TEXT, timeframe TEXT, level_price REAL,
      direction TEXT, touch_number INTEGER, drawdown REAL, reaction REAL,
      result TEXT, what_happened TEXT, notes TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);

  const levels = db.prepare(
    `SELECT l.*, s.date AS session_date FROM predictive_level l
     LEFT JOIN trading_session s ON s.id = l.session_id`
  ).all();
  if (!levels.length) return false;

  const ts = nowIso();
  const folderFor = (name) => {
    const slug = slugify(name);
    const found = db.prepare('SELECT id FROM level_folder WHERE slug = ?').get(slug);
    if (found) return found.id;
    const id = newId('lf');
    db.prepare(
      `INSERT INTO level_folder (id, name, slug, description, sort_order, archived, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 100, 0, ?, ?)`
    ).run(id, name, slug, ts, ts);
    return id;
  };

  const pretty = (v) => String(v ?? 'Custom').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const insertEx = db.prepare(
    `INSERT INTO level_example
      (id, folder_id, session_id, occurred_on, instrument, timeframe, level_price, direction,
       touch_number, drawdown, reaction, result, what_happened, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let carried = 0;
  for (const l of levels) {
    const folderId = folderFor(pretty(l.level_type_custom || l.level_type));
    const touches = tableExists(db, 'level_touch')
      ? db.prepare('SELECT * FROM level_touch WHERE level_id = ? ORDER BY touch_number').all(l.id)
      : [];

    // One row per touch. A level never touched still becomes one example, so
    // the prediction itself is not lost.
    const rows = touches.length ? touches : [null];
    for (const t of rows) {
      const result = t
        ? (t.reclaimed === 1 ? 'RECLAIMED' : t.held === 1 ? 'HELD' : t.failed === 1 ? 'FAILED' : null)
        : null;
      insertEx.run(
        newId('lex'), folderId, l.session_id ?? null, l.session_date ?? null,
        l.instrument ?? null, l.timeframe ?? null, l.reference_price ?? null,
        l.expected_direction === 'OBSERVATION' ? 'EITHER' : (l.expected_direction ?? null),
        t?.touch_number ?? null, t?.max_penetration ?? null, t?.reaction_size ?? null,
        result,
        t?.notes ?? l.prediction_before_touch ?? null,
        [l.why_matters, l.validation_notes].filter(Boolean).join('\n\n') || null,
        ts, ts
      );
      carried += 1;
    }
  }
  console.log(`[migrate] carried ${carried} level example(s) into the new library`);
  return true;
});

step('move-orphaned-screenshots', 'keep screenshots whose owner is going away', (db) => {
  if (!tableExists(db, 'screenshot')) return false;
  const n = db.prepare(
    `SELECT COUNT(*) AS n FROM screenshot WHERE entity_type IN
     ('PREDICTIVE_LEVEL','LEVEL_TOUCH','SIMULATED_TRADE','MORNING_ANALYSIS','EOD_REVIEW',
      'LEARNING_STUDY','LEARNING_EXAMPLE','PATTERN_CARD')`
  ).get()?.n ?? 0;
  if (n === 0) return false;
  db.exec("UPDATE screenshot SET entity_type = 'DAY_PREDICTION' WHERE entity_type = 'MORNING_ANALYSIS'");
  db.exec("UPDATE screenshot SET entity_type = 'DAY_REVIEW' WHERE entity_type = 'EOD_REVIEW'");
  // Level, touch and trade shots reattach to their day so the images survive.
  db.exec(`UPDATE screenshot SET entity_type = 'SESSION', entity_id = session_id
           WHERE entity_type IN ('PREDICTIVE_LEVEL','LEVEL_TOUCH','SIMULATED_TRADE')
             AND session_id IS NOT NULL`);
  db.exec(`DELETE FROM screenshot
           WHERE entity_type IN ('PREDICTIVE_LEVEL','LEVEL_TOUCH','SIMULATED_TRADE',
                                 'LEARNING_STUDY','LEARNING_EXAMPLE','PATTERN_CARD')`);
  return true;
});

step('drop-removed-subsystems', 'drop tables for features removed from the product', (db) => {
  // Everything here has either been carried into the new model above or was
  // scaffolding for a feature the product no longer has.
  const drop = [
    'study_observation', 'candle_snapshot', 'study_variable', 'learning_example', 'learning_study',
    'pattern_card_link', 'pattern_card',
    'playbook_version', 'playbook',
    'simulated_trade', 'level_touch', 'predictive_level',
    'morning_vs_actual', 'morning_addendum', 'timeline_event', 'note',
  ];
  let changed = false;
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of drop) {
    if (tableExists(db, t)) { db.exec(`DROP TABLE ${t}`); changed = true; }
  }
  db.exec('PRAGMA foreign_keys = ON');
  return changed;
});

step('drop-session-kind', 'every session is a studied historical day now', (db) => {
  if (!tableExists(db, 'trading_session')) return false;
  let changed = false;
  if (hasColumn(db, 'trading_session', 'kind')) {
    db.exec('DROP INDEX IF EXISTS ix_session_kind');
    db.exec('ALTER TABLE trading_session DROP COLUMN kind');
    changed = true;
  }
  if (hasColumn(db, 'trading_session', 'session_type')) {
    db.exec('ALTER TABLE trading_session DROP COLUMN session_type');
    changed = true;
  }
  return changed;
});

step('unseed-example-categories', 'remove the pre-created Market Example categories', (db) => {
  if (!tableExists(db, 'example_category')) return false;
  // Market Example categories are the trader's own vocabulary, so the app no
  // longer ships any. Remove only the ones it created and only while they are
  // still empty -- a seeded name that has been used, renamed or filled is the
  // trader's now and must be left alone.
  const SEEDED = [
    'ranges', 'bull-trends', 'bear-trends', 'trendlines', 'breakouts',
    'failed-breakouts', 'retests', 'reclaims', 'support', 'resistance',
    '4h-candles', '1h-candles', '15m-candles', 'liquidity-sweeps',
    'reversals', 'consolidation',
  ];
  const placeholders = SEEDED.map(() => '?').join(', ');
  const removed = db.prepare(
    `DELETE FROM example_category
      WHERE slug IN (${placeholders})
        AND id NOT IN (SELECT DISTINCT category_id FROM market_example)`
  ).run(...SEEDED);
  const n = Number(removed.changes ?? 0);
  if (n > 0) console.log(`[migrate] removed ${n} unused seeded category/categories`);
  return n > 0;
});

step('unseed-level-folders', 'remove the pre-created Level Library folders', (db) => {
  if (!tableExists(db, 'level_folder')) return false;
  // Level folders are the trader's own filing system, same as categories. The
  // app ships none. Remove only the ones it created, and only while they are
  // still empty -- a seeded folder that has been used or renamed is theirs now.
  const SEEDED = [
    'previous-day-high', 'previous-day-low', '4h-high', '4h-low',
    '1h-high', '1h-low', 'range-high', 'range-low',
    'trendline', 'vwap', 'previous-candle-high', 'previous-candle-low',
  ];
  const placeholders = SEEDED.map(() => '?').join(', ');
  const removed = db.prepare(
    `DELETE FROM level_folder
      WHERE slug IN (${placeholders})
        AND id NOT IN (SELECT DISTINCT folder_id FROM level_example)`
  ).run(...SEEDED);
  const n = Number(removed.changes ?? 0);
  if (n > 0) console.log(`[migrate] removed ${n} unused seeded folder(s)`);
  return n > 0;
});

step('certify-levels', 'level_folder + level_example -> certified_level', (db) => {
  if (!tableExists(db, 'level_folder') && !tableExists(db, 'level_example')) return false;

  db.exec(`
    CREATE TABLE IF NOT EXISTS certified_level (
      id TEXT PRIMARY KEY, level_price REAL NOT NULL, instrument TEXT, source TEXT,
      timeframe TEXT, period_tested TEXT, direction TEXT NOT NULL DEFAULT 'BOTH',
      first_touch_pct REAL, first_touch_note TEXT,
      buy_avg_stop REAL, buy_avg_profit REAL, buy_best_profit REAL,
      sell_avg_stop REAL, sell_avg_profit REAL, sell_best_profit REAL,
      classification TEXT, importance TEXT, sample_size INTEGER, notes TEXT,
      session_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);

  const ts = nowIso();
  const insert = db.prepare(
    `INSERT INTO certified_level
      (id, level_price, instrument, source, timeframe, direction, first_touch_pct,
       buy_avg_stop, buy_avg_profit, sell_avg_stop, sell_avg_profit,
       sample_size, notes, session_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  const folders = tableExists(db, 'level_folder')
    ? db.prepare('SELECT * FROM level_folder').all() : [];
  let carried = 0;

  for (const f of folders) {
    const rows = tableExists(db, 'level_example')
      ? db.prepare('SELECT * FROM level_example WHERE folder_id = ?').all(f.id) : [];

    // A folder named like "4hr Level - 29529.66" already carries its price.
    // Pull it out and keep the rest as the source description. "4hr" also
    // contains a number, so score the candidates: a decimal point or simply
    // more digits means it is the price rather than a timeframe.
    const candidates = [...String(f.name ?? '').matchAll(/\d[\d,]*(?:\.\d+)?/g)];
    const priceInName = candidates.length
      ? candidates.reduce((best, m) => {
          const score = (t) => (t.includes('.') ? 100 : 0) + t.replace(/\D/g, '').length;
          return score(m[0]) > score(best[0]) ? m : best;
        })
      : null;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const avg = (vals) => {
      const n = vals.filter((v) => typeof v === 'number' && Number.isFinite(v));
      return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 100) / 100 : null;
    };

    const price = num(rows.find((r) => num(r.level_price))?.level_price)
      ?? (priceInName ? Number(priceInName[0].replace(/,/g, '')) : null);

    // Without a price there is nothing to certify; skip rather than invent one.
    if (price === null || !Number.isFinite(price)) continue;

    const source = (priceInName
      ? String(f.name).replace(priceInName[0], '').replace(/[-–—\s]+$/, '').trim()
      : String(f.name ?? '').trim()) || null;

    const dirs = new Set(rows.map((r) => r.direction).filter(Boolean));
    const direction = dirs.has('LONG') && dirs.has('SHORT') ? 'BOTH'
      : dirs.has('LONG') ? 'BUY'
        : dirs.has('SHORT') ? 'SELL' : 'BOTH';

    // Old per-touch measurements roll up into the new averages: drawdown was
    // the room the level needed, reaction was what it gave back.
    const longs = rows.filter((r) => r.direction === 'LONG');
    const shorts = rows.filter((r) => r.direction === 'SHORT');
    const firstTouches = rows.filter((r) => r.touch_number === 1 && r.result);
    const held = firstTouches.filter((r) => ['HELD', 'RECLAIMED'].includes(r.result)).length;

    insert.run(
      newId('lvl'), price,
      rows.find((r) => r.instrument)?.instrument ?? null,
      source,
      rows.find((r) => r.timeframe)?.timeframe ?? null,
      direction,
      firstTouches.length ? Math.round((held / firstTouches.length) * 100) : null,
      avg(longs.map((r) => r.drawdown)), avg(longs.map((r) => r.reaction)),
      avg(shorts.map((r) => r.drawdown)), avg(shorts.map((r) => r.reaction)),
      rows.length || null,
      [f.description, ...rows.map((r) => r.notes).filter(Boolean)].filter(Boolean).join('\n\n') || null,
      rows.find((r) => r.session_id)?.session_id ?? null,
      ts, ts
    );
    carried += 1;
  }

  // Evidence charts follow their level.
  if (tableExists(db, 'screenshot')) {
    db.exec("UPDATE screenshot SET entity_type = 'CERTIFIED_LEVEL' WHERE entity_type = 'LEVEL_EXAMPLE'");
  }
  if (tableExists(db, 'entity_tag')) {
    db.exec("UPDATE entity_tag SET entity_type = 'CERTIFIED_LEVEL' WHERE entity_type = 'LEVEL_EXAMPLE'");
  }

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('DROP TABLE IF EXISTS level_example');
  db.exec('DROP TABLE IF EXISTS level_folder');
  db.exec('PRAGMA foreign_keys = ON');

  console.log(`[migrate] certified ${carried} level(s) from the old folder model`);
  return true;
});

// ---------------------------------------------------------------------------
/**
 * Runs BEFORE schema.sql, so renames happen while the new table name is still
 * free. Every step is existence-guarded, so on a fresh database they all no-op
 * and schema.sql produces the final shape directly.
 */
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migration (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(db.prepare('SELECT id FROM schema_migration').all().map((r) => r.id));
  const done = [];

  for (const s of STEPS) {
    if (applied.has(s.id)) continue;
    let changed = false;
    try {
      changed = s.run(db);
    } catch (err) {
      console.error(`[migrate] FAILED ${s.id} (${s.describe}): ${err.message}`);
      throw err;
    }
    db.prepare('INSERT INTO schema_migration (id, applied_at) VALUES (?, ?)').run(s.id, nowIso());
    if (changed) done.push(s.id);
  }

  if (done.length) console.log(`[migrate] applied: ${done.join(', ')}`);
  return done;
}
