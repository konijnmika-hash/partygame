// Runs the browser end-to-end suite against a freshly built production server.
//   npm run test:e2e                 → full UI session flow + smoke test of a sample of games
//   npm run test:e2e -- --all        → flow + smoke test of every game (slow, ~10 s per game)
//   npm run test:e2e -- --games=a,b  → flow + smoke test of the listed game ids
//   add --no-build to reuse an existing dist/ build
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const SAMPLE = ['lightning-reflex', 'draw-guess', 'two-truths', 'memory-tiles', 'word-scramble', 'wobbly-tower', 'kart-race', 'blob-soccer', 'meme-caption', 'neon-trails', 'hover-hop'];

function freePort() {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  return r.status ?? 1;
}

async function main() {
  if (!flag('no-build')) {
    console.log('building…');
    if (run('npm', ['run', 'build', '--silent']) !== 0) process.exit(1);
  }
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), 'bloop-e2e-'));
  const server = spawn('node', ['dist/server/index.js'], {
    env: { ...process.env, PORT: String(port), DATABASE_PATH: join(dir, 'e2e.db'), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  const base = `http://localhost:${port}`;
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 250));
    up = await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false);
  }
  let code = 1;
  try {
    if (!up) throw new Error('server did not start:\n' + log);
    code = run('node', ['tests/e2e/flow.cjs', base]);
    const games = flag('all') ? 'all' : flag('games') ? flag('games').split('=')[1] : SAMPLE.join(',');
    if (code === 0) code = run('node', ['tests/e2e/smoke-games.cjs', base, games, '8']);
  } catch (e) {
    console.error(e.message);
  } finally {
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  }
  process.exit(code);
}

main();
