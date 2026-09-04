import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, insert, newId, nowIso, run, update } from '../db/index.js';
import { UPLOAD_DIR } from '../db/index.js';
import { SCREENSHOT_ENTITY } from '../../../shared/domain.js';

const router = Router();

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase().slice(0, 6);
    cb(null, `${newId('img')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

router.get('/', (req, res) => {
  const { entity_type: entityType, entity_id: entityId, session_id: sessionId, category, limit = 200 } = req.query;
  const where = [];
  const params = [];
  if (entityType) { where.push('entity_type = ?'); params.push(entityType); }
  if (entityId) { where.push('entity_id = ?'); params.push(entityId); }
  if (sessionId) { where.push('session_id = ?'); params.push(sessionId); }
  if (category) { where.push('category = ?'); params.push(category); }
  res.json(
    all(
      `SELECT * FROM screenshot ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC LIMIT ?`,
      [...params, Number(limit)]
    )
  );
});

router.post('/', upload.array('files', 20), (req, res) => {
  const b = req.body ?? {};
  const entityType = b.entity_type;
  if (!SCREENSHOT_ENTITY.includes(entityType)) {
    return res.status(400).json({ error: `entity_type must be one of ${SCREENSHOT_ENTITY.join(', ')}` });
  }
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  // Captions arrive positionally: captions[0] belongs to files[0].
  const captions = Array.isArray(b.captions) ? b.captions : b.captions ? [b.captions] : [];
  const ts = nowIso();
  const created = [];
  const baseOrder =
    get('SELECT COALESCE(MAX(sort_order), -1) AS n FROM screenshot WHERE entity_type = ? AND entity_id = ?',
      [entityType, b.entity_id ?? null])?.n ?? -1;

  req.files.forEach((file, i) => {
    const id = newId('shot');
    insert('screenshot', {
      id,
      session_id: b.session_id ?? null,
      entity_type: entityType,
      entity_id: b.entity_id ?? null,
      category: b.category ?? null,
      caption: captions[i] ?? b.caption ?? null,
      filename: file.filename,
      original_name: file.originalname,
      mime: file.mimetype,
      size_bytes: file.size,
      sort_order: baseOrder + 1 + i,
      created_at: ts,
    });
    created.push(get('SELECT * FROM screenshot WHERE id = ?', [id]));
  });

  res.status(201).json(created);
});

router.patch('/:id', (req, res) => {
  update('screenshot', req.params.id, req.body, ['caption', 'category', 'sort_order']);
  res.json(get('SELECT * FROM screenshot WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  const shot = get('SELECT * FROM screenshot WHERE id = ?', [req.params.id]);
  if (!shot) return res.status(404).json({ error: 'Not found' });
  run('DELETE FROM screenshot WHERE id = ?', [req.params.id]);
  // Remove the file only after the row is gone, and never fail the request on it.
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, shot.filename));
  } catch {
    /* file already missing - nothing to clean up */
  }
  res.json({ ok: true });
});

export default router;
