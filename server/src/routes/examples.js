import { Router } from 'express';
import { all, get, insert, newId, nowIso, run, update } from '../db/index.js';

const router = Router();

/**
 * Market Examples: the visual textbook.
 *
 * A category is a chapter, an example is a page, and the screenshot is most of
 * the page. There are no statistics here on purpose -- this section is for
 * looking at charts.
 */

const CATEGORY_FIELDS = ['name', 'description', 'sort_order', 'archived'];

const EXAMPLE_FIELDS = [
  'category_id', 'session_id', 'title', 'occurred_on', 'instrument', 'timeframe',
  'description', 'what_i_see', 'what_makes_valid', 'what_invalidates',
  'what_happened_next', 'what_i_learned',
];

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const shotsFor = (id) =>
  all(
    "SELECT * FROM screenshot WHERE entity_type = 'MARKET_EXAMPLE' AND entity_id = ? ORDER BY sort_order, created_at",
    [id]
  );

const tagsFor = (id) =>
  all(
    `SELECT t.name FROM tag t JOIN entity_tag et ON et.tag_id = t.id
     WHERE et.entity_type = 'MARKET_EXAMPLE' AND et.entity_id = ? ORDER BY t.name`,
    [id]
  ).map((r) => r.name);

function setTags(entityId, names) {
  if (!Array.isArray(names)) return;
  run("DELETE FROM entity_tag WHERE entity_type = 'MARKET_EXAMPLE' AND entity_id = ?", [entityId]);
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
      "INSERT INTO entity_tag (tag_id, entity_type, entity_id) VALUES (?, 'MARKET_EXAMPLE', ?) ON CONFLICT DO NOTHING",
      [tag.id, entityId]
    );
  }
}

// ------------------------------------------------------------- categories --
router.get('/categories', (req, res) => {
  res.json(
    all(
      `SELECT c.*,
         (SELECT COUNT(*) FROM market_example m WHERE m.category_id = c.id) AS example_count,
         (SELECT filename FROM screenshot s
           JOIN market_example m2 ON m2.id = s.entity_id
          WHERE s.entity_type = 'MARKET_EXAMPLE' AND m2.category_id = c.id
          ORDER BY s.created_at DESC LIMIT 1) AS thumb
       FROM example_category c
       ${req.query.archived === '1' ? '' : 'WHERE c.archived = 0'}
       ORDER BY c.sort_order, c.name`
    )
  );
});

router.post('/categories', (req, res) => {
  const b = req.body ?? {};
  if (!b.name?.trim()) return res.status(400).json({ error: 'name is required' });
  const slug = slugify(b.name);
  if (!slug) return res.status(400).json({ error: 'name must contain letters or numbers' });
  if (get('SELECT id FROM example_category WHERE slug = ?', [slug])) {
    return res.status(409).json({ error: `A category called "${b.name}" already exists.` });
  }
  const ts = nowIso();
  const id = newId('ec');
  const next = (get('SELECT COALESCE(MAX(sort_order), -1) AS n FROM example_category')?.n ?? -1) + 1;
  insert('example_category', {
    id,
    name: b.name.trim(),
    slug,
    description: b.description ?? null,
    sort_order: b.sort_order ?? next,
    archived: 0,
    created_at: ts,
    updated_at: ts,
  });
  res.status(201).json(get('SELECT * FROM example_category WHERE id = ?', [id]));
});

router.patch('/categories/:id', (req, res) => {
  if (!get('SELECT id FROM example_category WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Category not found' });
  }
  const body = { ...req.body, updated_at: nowIso() };
  if (body.name) body.slug = slugify(body.name);
  update('example_category', req.params.id, body, [...CATEGORY_FIELDS, 'slug', 'updated_at']);
  res.json(get('SELECT * FROM example_category WHERE id = ?', [req.params.id]));
});

router.delete('/categories/:id', (req, res) => {
  const n = get('SELECT COUNT(*) AS n FROM market_example WHERE category_id = ?', [req.params.id])?.n ?? 0;
  if (n > 0 && req.query.force !== '1') {
    return res.status(409).json({
      error: `This category holds ${n} example${n === 1 ? '' : 's'}. Deleting it would delete them too.`,
      example_count: n,
    });
  }
  run('DELETE FROM example_category WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/** One category, as a gallery. */
router.get('/categories/:slug', (req, res) => {
  const category = get('SELECT * FROM example_category WHERE slug = ? OR id = ?', [
    req.params.slug, req.params.slug,
  ]);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const where = ['m.category_id = ?'];
  const params = [category.id];
  if (req.query.timeframe) { where.push('m.timeframe = ?'); params.push(req.query.timeframe); }
  if (req.query.instrument) { where.push('m.instrument = ?'); params.push(req.query.instrument); }
  if (req.query.search) {
    const q = `%${req.query.search}%`;
    where.push('(m.title LIKE ? OR m.description LIKE ? OR m.what_i_see LIKE ? OR m.what_i_learned LIKE ?)');
    params.push(q, q, q, q);
  }

  const examples = all(
    `SELECT m.*, s.date AS session_date FROM market_example m
     LEFT JOIN trading_session s ON s.id = m.session_id
     WHERE ${where.join(' AND ')}
     ORDER BY m.occurred_on DESC, m.created_at DESC`,
    params
  ).map((m) => ({ ...m, screenshots: shotsFor(m.id), tags: tagsFor(m.id) }));

  const allExamples = all('SELECT * FROM market_example WHERE category_id = ?', [category.id]);

  res.json({
    category,
    examples,
    total_count: allExamples.length,
    timeframes: [...new Set(allExamples.map((m) => m.timeframe).filter(Boolean))],
    instruments: [...new Set(allExamples.map((m) => m.instrument).filter(Boolean))],
  });
});

// --------------------------------------------------------------- examples --
router.get('/:id', (req, res) => {
  const m = get(
    `SELECT m.*, c.name AS category_name, c.slug AS category_slug, s.date AS session_date
     FROM market_example m
     JOIN example_category c ON c.id = m.category_id
     LEFT JOIN trading_session s ON s.id = m.session_id
     WHERE m.id = ?`,
    [req.params.id]
  );
  if (!m) return res.status(404).json({ error: 'Example not found' });
  res.json({ ...m, screenshots: shotsFor(m.id), tags: tagsFor(m.id) });
});

router.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.category_id) return res.status(400).json({ error: 'category_id is required' });
  if (!b.title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!get('SELECT id FROM example_category WHERE id = ?', [b.category_id])) {
    return res.status(404).json({ error: 'Category not found' });
  }
  const ts = nowIso();
  const id = newId('mex');
  const data = { id, created_at: ts, updated_at: ts };
  for (const f of EXAMPLE_FIELDS) if (b[f] !== undefined) data[f] = b[f] === '' ? null : b[f];
  data.id = id;
  data.category_id = b.category_id;
  data.title = b.title.trim();
  data.created_at = ts;
  data.updated_at = ts;
  insert('market_example', data);
  setTags(id, b.tags);
  res.status(201).json({ ...get('SELECT * FROM market_example WHERE id = ?', [id]), screenshots: [], tags: tagsFor(id) });
});

router.patch('/:id', (req, res) => {
  if (!get('SELECT id FROM market_example WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Example not found' });
  }
  update('market_example', req.params.id, { ...req.body, updated_at: nowIso() }, [
    ...EXAMPLE_FIELDS, 'updated_at',
  ]);
  if (req.body.tags !== undefined) setTags(req.params.id, req.body.tags);
  const m = get('SELECT * FROM market_example WHERE id = ?', [req.params.id]);
  res.json({ ...m, screenshots: shotsFor(m.id), tags: tagsFor(m.id) });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM market_example WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
