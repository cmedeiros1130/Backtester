/**
 * Startup preflight.
 *
 * Imported before anything that touches the database, so a host running the
 * wrong Node version fails with a sentence you can act on instead of a stack
 * trace about a missing module.
 *
 * LevelForge uses the built-in `node:sqlite`. That means no native module to
 * compile, but it does mean the runtime has to be new enough to expose it
 * without a flag.
 */

const MIN_MAJOR = 23;
const MIN_MINOR = 4;

function fail(lines) {
  console.error('\n  LevelForge cannot start\n');
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

const [major, minor] = process.versions.node.split('.').map(Number);

if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
  fail([
    `Node ${process.versions.node} is too old — LevelForge needs Node ${MIN_MAJOR}.${MIN_MINOR} or newer.`,
    '',
    'It stores everything in SQLite through the built-in `node:sqlite` module,',
    `which is only available unflagged from Node ${MIN_MAJOR}.${MIN_MINOR}.`,
    '',
    'On a host, set the Node version to 24 (a .node-version file is included).',
  ]);
}

try {
  await import('node:sqlite');
} catch (err) {
  fail([
    'This Node build does not provide `node:sqlite`.',
    `Running: Node ${process.versions.node}`,
    '',
    'Use an official Node 24 build. The bundled .node-version file pins this',
    'for hosts that read it.',
    '',
    `Original error: ${err.message}`,
  ]);
}
