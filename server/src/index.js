import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Must run before anything imports the database.
import './preflight.js';

import { UPLOAD_DIR, DATA_DIR } from './db/index.js';
import days from './routes/days.js';
import library from './routes/library.js';
import examples from './routes/examples.js';
import home from './routes/home.js';
import search from './routes/search.js';
import screenshots from './routes/screenshots.js';
import settings from './routes/settings.js';
// Preserved, not surfaced: market data adapters + the replay future-data guard.
import market from './routes/market.js';
import * as domain from '../../shared/domain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Hosts assign the port; HOST must be 0.0.0.0 for the platform to reach it.
const PORT = Number(process.env.PORT ?? 4310);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.use(compression());

// In development the Vite dev server runs on a different port, so it needs
// CORS. In production the API and the UI are the same origin and opening it up
// would only widen the surface of a personal, single-user app.
if (!IS_PROD) app.use(cors());

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) =>
  res.json({ ok: true, data_dir: DATA_DIR, version: '1.0.0' })
);

/** The enum vocabulary, served so the client and database can never drift. */
app.get('/api/domain', (req, res) => res.json(domain));

app.use('/api/days', days);
app.use('/api/library', library);
app.use('/api/examples', examples);
app.use('/api/home', home);
app.use('/api/search', search);
app.use('/api/screenshots', screenshots);
app.use('/api/settings', settings);
app.use('/api/market', market);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));

// Serve the built client so production runs from one process. In development
// Vite serves the client instead and proxies /api and /uploads back here.
const CLIENT_DIST = process.env.LEVELFORGE_CLIENT_DIST
  ? path.resolve(process.env.LEVELFORGE_CLIENT_DIST)
  : path.resolve(__dirname, '../../client/dist');

const hasClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

if (hasClient) {
  // Hashed asset filenames change on every build, so they can be cached hard.
  // index.html must not be, or a deploy would not reach anyone.
  app.use(express.static(CLIENT_DIST, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // Client-side routes: anything that is not an API call or an upload returns
  // the app shell, so refreshing /library/range-low directly still works.
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else if (IS_PROD) {
  console.error(`\n  No built client found at ${CLIENT_DIST}`);
  console.error('  Run `npm run build` before `npm start`. Serving the API only.\n');
}

// Error handler last. Multer and validation errors surface as clean JSON
// instead of an HTML stack trace the UI cannot display.
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = err.status ?? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({ error: err.message ?? 'Unexpected server error' });
});

app.listen(PORT, HOST, () => {
  const where = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`\n  LevelForge ${IS_PROD ? '(production)' : '(development)'}`);
  console.log(`  server          →  ${where}`);
  console.log(`  data directory  →  ${DATA_DIR}`);
  console.log(`  client          →  ${hasClient ? CLIENT_DIST : 'not built (API only)'}\n`);
});
