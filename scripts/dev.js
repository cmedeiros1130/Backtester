/**
 * Development launcher: runs the API and the Vite dev server together.
 *
 * Deliberately dependency-free so `npm run dev` works straight after cloning,
 * before anything is installed at the repo root.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const procs = [];

function run(name, cwd, args, color) {
  const child = spawn(npm, args, { cwd: path.join(root, cwd), shell: process.platform === 'win32' });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) process.stdout.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
    shutdown(code ?? 0);
  });
  procs.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) { try { p.kill(); } catch { /* already gone */ } }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', 'server', ['run', 'dev'], '36');
run('web', 'client', ['run', 'dev'], '35');

console.log('\n  LevelForge dev\n  web  http://localhost:4300\n  api  http://localhost:4310\n');
