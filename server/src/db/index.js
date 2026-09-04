import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.LEVELFORGE_DATA_DIR
  ? path.resolve(process.env.LEVELFORGE_DATA_DIR)
  : path.resolve(__dirname, '../../../data');

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'levelforge.db');

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA synchronous = NORMAL');

// Migrations first, then the schema. See migrate() for why the order matters.
migrate(db);

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

db.prepare(
  `INSERT INTO schema_meta(key, value) VALUES('version', '1')
   ON CONFLICT(key) DO NOTHING`
).run();

console.log(`[db] ready at ${DB_PATH}`);

// ---------------------------------------------------------------------------
// Small query helpers. node:sqlite returns null-prototype objects; spreading
// them into plain objects keeps JSON.stringify and downstream code predictable.
// ---------------------------------------------------------------------------
const plain = (row) => (row ? { ...row } : row);

export function all(sql, params = []) {
  return db.prepare(sql).all(...params).map(plain);
}

export function get(sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return row === undefined ? null : plain(row);
}

export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix = '') {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return prefix ? `${prefix}_${raw}` : raw;
}

/**
 * Build an INSERT from a plain object. Undefined values are skipped so callers
 * can pass partial payloads without clobbering column defaults.
 */
export function insert(table, data) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => k);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols
    .map(() => '?')
    .join(', ')})`;
  run(sql, entries.map(([, v]) => v));
  return data.id;
}

/**
 * Build an UPDATE from a plain object, restricted to an allow-list of columns.
 * Returns the number of columns actually written.
 */
export function update(table, id, data, allowed) {
  const entries = Object.entries(data).filter(
    ([k, v]) => v !== undefined && (!allowed || allowed.includes(k))
  );
  if (entries.length === 0) return 0;
  const sql = `UPDATE ${table} SET ${entries
    .map(([k]) => `${k} = ?`)
    .join(', ')} WHERE id = ?`;
  run(sql, [...entries.map(([, v]) => v), id]);
  return entries.length;
}
