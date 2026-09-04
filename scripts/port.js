/**
 * Prints the port LevelForge will actually listen on.
 *
 * The launcher scripts call this instead of hardcoding a number, so if the
 * server's default ever changes the shortcuts keep working. Read straight from
 * the server source; a PORT environment variable still wins, exactly as the
 * server itself decides it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let fallback = 4310;
try {
  const src = fs.readFileSync(path.join(root, 'server', 'src', 'index.js'), 'utf8');
  const match = src.match(/process\.env\.PORT\s*\?\?\s*(\d+)/);
  if (match) fallback = Number(match[1]);
} catch {
  /* keep the fallback */
}

process.stdout.write(String(process.env.PORT || fallback));
