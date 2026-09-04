import { Router } from 'express';
import { all, get, insert, newId, nowIso, run, update } from '../db/index.js';
import { describe, round } from '../lib/stats.js';
import { HELD_RESULTS } from '../../../shared/domain.js';

const router = Router();

/**
 * The Level Library: folders of level types, each holding every example you
 * have filed for it.
 *
 * The summary at the top of a folder is deliberately plain -- counts, averages,
 * medians and a per-touch breakdown. The examples and their screenshots are the
 * substance; these numbers are just the label on the drawer.
 */

const FOLDER_FIELDS = ['name', 'description', 'sort_order', 'archived'];

const EXAMPLE_FIELDS = [
  'folder_id', 'session_id', 'occurred_on', 'instrument', 'timeframe', 'level_price',
  'direction', 'touch_number', 'drawdown', 'reaction', 'result', 'what_happened', 'notes',
];

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const shotsFor = (id) =>
  all(
    "SELECT * FROM screenshot WHERE entity_type = 'LEVEL_EXAMPLE' AND entity_id = ? ORDER BY sort_order, created_at",
    [id]
  );

const tagsFor = (id) =>
  all(
    `SELECT t.name FROM tag t JOIN entity_tag et ON et.tag_id = t.id
     WHERE et.entity_type = 'LEVEL_EXAMPLE' AND et.entity_id = ? ORDER BY t.name`,
    [id]
  ).map((r) => r.name);

/** Attach tags by name, creating any that are new. */
function setTags(entityType, entityId, names) {
  if (!Array.isArray(names)) return;
  run('DELETE FROM entity_tag WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
  const ts = nowIso();
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    let tag = get('SELECT id FROM tag WHERE name = ?', [name]);
    if (!tag) {
      const id = newId('tag');
      insert('tag', { id, name, created_at: ts });
      tag = { id };
    }
    run(
      'INSERT INTO entity_tag (tag_id, entity_type, entity_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      [tag.id, entityType, entityId]
    );
  }
}

/**
 * Folder statistics. Counts, means, medians, and how each touch number fared.
 * Nothing weighted, nothing scored -- just what the examples say.
 */
function summarise(examples) {
  const withResult = examples.filter((e) => e.result);
  const held = withResult.filter((e) => HELD_RESULTS.includes(e.result)).length;

  const bucket = (rows) => {
    const r = rows.filter((e) => e.result);
    const h = r.filter((e) => HELD_RESULTS.includes(e.result)).length;
    return {
      total: rows.length,
      with_result: r.length,
      held: h,
      failed: r.length - h,
      held_pct: r.length ? round((h / r.length) * 100, 0) : null,
      avg_drawdown: round(describe(rows.map((e) => e.drawdown)).mean, 2),
      median_drawdown: round(describe(rows.map((e) => e.drawdown)).median, 2),
      avg_reaction: round(describe(rows.map((e) => e.reaction)).mean, 2),
      median_reaction: round(describe(rows.map((e) => e.reaction)).median, 2),
    };
  };

  return {
    ...bucket(examples),
    by_touch: [1, 2, 3].map((n) => ({
      touch: String(n),
      ...bucket(examples.filter((e) => e.touch_number === n)),
    })).concat([{
      touch: '4+',
      ...bucket(examples.filter((e) => (e.touch_number ?? 0) >= 4)),
    }]),
    by_timeframe: [...new Set(examples.map((e) => e.timeframe).filter(Boolean))]
      .map((tf) => ({ timeframe: tf, ...bucket(examples.filter((e) => e.timeframe === tf)) }))
      .sort((a, b) => b.total - a.total),
  };
}

// ---------------------------------------------------------------- folders --
router.get('/folders', (req, res) => {
  res.json(
    all(
      `SELECT f.*,
         (SELECT COUNT(*) FROM level_example e WHERE e.folder_id = f.id) AS example_count,
         (SELECT filename FROM screenshot s
           JOIN level_example e2 ON e2.id = s.entity_id
          WHERE s.entity_type = 'LEVEL_EXAMPLE' AND e2.folder_id = f.id
          ORDER BY s.created_at DESC LIMIT 1) AS thumb
       FROM level_folder f
       ${req.query.archived === '1' ? '' : 'WHERE f.archived = 0'}
       ORDER BY f.sort_order, f.name`
    )
  );
});

router.post('/folders', (req, res) => {
  const b = req.body ?? {};
  if (!b.name?.trim()) return res.status(400).json({ error: 'name is required' });
  const slug = slugify(b.name);
  if (!slug) return res.status(400).json({ error: 'name must contain letters or numbers' });
  if (get('SELECT id FROM level_folder WHERE slug = ?', [slug])) {
    return res.status(409).json({ error: `A folder called "${b.name}" already exists.` });
  }
  const ts = nowIso();
  const id = newId('lf');
  const next = (get('SELECT COALESCE(MAX(sort_order), -1) AS n FROM level_folder')?.n ?? -1) + 1;
  insert('level_folder', {
    id,
    name: b.name.trim(),
    slug,
    description: b.description ?? null,
    sort_order: b.sort_order ?? next,
    archived: 0,
    created_at: ts,
    updated_at: ts,
  });
  res.status(201).json(get('SELECT * FROM level_folder WHERE id = ?', [id]));
});

router.patch('/folders/:id', (req, res) => {
  const folder = get('SELECT * FROM level_folder WHERE id = ?', [req.params.id]);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  const body = { ...req.body, updated_at: nowIso() };
  if (body.name) body.slug = slugify(body.name);
  update('level_folder', req.params.id, body, [...FOLDER_FIELDS, 'slug', 'updated_at']);
  res.json(get('SELECT * FROM level_folder WHERE id = ?', [req.params.id]));
});

router.delete('/folders/:id', (req, res) => {
  const n = get('SELECT COUNT(*) AS n FROM level_example WHERE folder_id = ?', [req.params.id])?.n ?? 0;
  if (n > 0 && req.query.force !== '1') {
    return res.status(409).json({
      error: `This folder holds ${n} example${n === 1 ? '' : 's'}. Deleting it would delete them too.`,
      example_count: n,
    });
  }
  run('DELETE FROM level_folder WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/** One folder with its examples, filtered by timeframe / result / search. */
router.get('/folders/:slug', (req, res) => {
  const folder = get('SELECT * FROM level_folder WHERE slug = ? OR id = ?', [
    req.params.slug, req.params.slug,
  ]);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const where = ['e.folder_id = ?'];
  const params = [folder.id];
  if (req.query.timeframe) { where.push('e.timeframe = ?'); params.push(req.query.timeframe); }
  if (req.query.result) { where.push('e.result = ?'); params.push(req.query.result); }
  if (req.query.instrument) { where.push('e.instrument = ?'); params.push(req.query.instrument); }
  if (req.query.touch) {
    if (String(req.query.touch).endsWith('+')) {
      where.push('e.touch_number >= ?');
      params.push(Number(String(req.query.touch).replace('+', '')));
    } else {
      where.push('e.touch_number = ?');
      params.push(Number(req.query.touch));
    }
  }
  if (req.query.search) {
    where.push('(e.what_happened LIKE ? OR e.notes LIKE ? OR CAST(e.level_price AS TEXT) LIKE ?)');
    const q = `%${req.query.search}%`;
    params.push(q, q, q);
  }

  const examples = all(
    `SELECT e.*, s.date AS session_date
     FROM level_example e
     LEFT JOIN trading_session s ON s.id = e.session_id
     WHERE ${where.join(' AND ')}
     ORDER BY e.occurred_on DESC, e.created_at DESC`,
    params
  ).map((e) => ({ ...e, screenshots: shotsFor(e.id), tags: tagsFor(e.id) }));

  // The summary always describes the whole folder, so filtering the gallery
  // never silently changes the numbers you are comparing against.
  const allExamples = all('SELECT * FROM level_example WHERE folder_id = ?', [folder.id]);

  res.json({
    folder,
    examples,
    filtered_count: examples.length,
    summary: summarise(allExamples),
    timeframes: [...new Set(allExamples.map((e) => e.timeframe).filter(Boolean))],
    instruments: [...new Set(allExamples.map((e) => e.instrument).filter(Boolean))],
  });
});

// --------------------------------------------------------------- examples --
router.get('/examples/:id', (req, res) => {
  const e = get(
    `SELECT e.*, f.name AS folder_name, f.slug AS folder_slug, s.date AS session_date
     FROM level_example e
     JOIN level_folder f ON f.id = e.folder_id
     LEFT JOIN trading_session s ON s.id = e.session_id
     WHERE e.id = ?`,
    [req.params.id]
  );
  if (!e) return res.status(404).json({ error: 'Example not found' });
  res.json({ ...e, screenshots: shotsFor(e.id), tags: tagsFor(e.id) });
});

router.post('/examples', (req, res) => {
  const b = req.body ?? {};
  if (!b.folder_id) return res.status(400).json({ error: 'folder_id is required' });
  if (!get('SELECT id FROM level_folder WHERE id = ?', [b.folder_id])) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  const ts = nowIso();
  const id = newId('lex');
  const data = { id, created_at: ts, updated_at: ts };
  for (const f of EXAMPLE_FIELDS) if (b[f] !== undefined) data[f] = b[f] === '' ? null : b[f];
  data.id = id;
  data.folder_id = b.folder_id;
  data.created_at = ts;
  data.updated_at = ts;
  insert('level_example', data);
  setTags('LEVEL_EXAMPLE', id, b.tags);
  res.status(201).json({ ...get('SELECT * FROM level_example WHERE id = ?', [id]), screenshots: [], tags: tagsFor(id) });
});

router.patch('/examples/:id', (req, res) => {
  if (!get('SELECT id FROM level_example WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Example not found' });
  }
  update('level_example', req.params.id, { ...req.body, updated_at: nowIso() }, [
    ...EXAMPLE_FIELDS, 'updated_at',
  ]);
  if (req.body.tags !== undefined) setTags('LEVEL_EXAMPLE', req.params.id, req.body.tags);
  const e = get('SELECT * FROM level_example WHERE id = ?', [req.params.id]);
  res.json({ ...e, screenshots: shotsFor(e.id), tags: tagsFor(e.id) });
});

router.delete('/examples/:id', (req, res) => {
  run('DELETE FROM level_example WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
