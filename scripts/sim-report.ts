// Prints simulated duration + score spread for each implemented game (balance sanity check).
import { GAME_DEFS } from '../server/games/index';
import { GAME_MAP } from '../shared/catalog/index';
import { simulateGame } from '../tests/helpers/simulate';

const only = process.argv[2] ? process.argv[2].split(',') : null;
for (const def of GAME_DEFS) {
  if (only && !only.some((o) => def.id.startsWith(o))) continue;
  const meta = GAME_MAP[def.id];
  const n = Math.min(meta.maxPlayers, Math.max(meta.minPlayers, 5));
  const r = simulateGame(def, { players: n, seed: 4242 });
  const pts = Object.values(r.points).sort((a, b) => b - a);
  const perfs = Object.values(r.results?.perfs ?? {}).map((p) => Math.round(p.perf * 100));
  console.log(
    `${def.id.padEnd(26)} ${String(Math.round(r.simulatedMs / 1000)).padStart(4)}s (expected ~${meta.duration}s)  pts ${pts.join(',')}  perf% ${perfs.join(',')}  pub ${Math.round(r.maxPubBytes / 1024)}KB${r.errors.length ? '  ERRORS: ' + r.errors.length : ''}`,
  );
}
