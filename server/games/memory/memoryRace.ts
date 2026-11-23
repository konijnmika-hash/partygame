import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const COLS = 5;
const ROWS = 8;
const LIMIT = 90_000;

interface S {
  path: number[];
  pathSet: Set<number>;
  start: number;
  traps: number[];
  pos: Record<string, number>;
  stunned: Record<string, number>;
  best: Record<string, number>; // furthest path index reached
  finished: string[];
  phase: 'preview' | 'race';
  previewUntil: number;
  endsAt: number;
  falls: Record<string, number>;
}

/** Random monotone-ish path from the bottom row to the top row. */
function makePath(ctx: GameCtx): number[] {
  let c = ctx.rng.int(0, COLS - 1);
  let r = ROWS - 1;
  const path = [r * COLS + c];
  while (r > 0) {
    const sideways = ctx.rng.chance(0.45) && path.length > 0;
    if (sideways) {
      const dir = ctx.rng.chance(0.5) ? -1 : 1;
      const nc = Math.max(0, Math.min(COLS - 1, c + dir));
      if (nc !== c && !path.includes(r * COLS + nc)) {
        c = nc;
        path.push(r * COLS + c);
        continue;
      }
    }
    r--;
    path.push(r * COLS + c);
  }
  return path;
}

function adjacent(a: number, b: number): boolean {
  const ar = Math.floor(a / COLS), ac = a % COLS, br = Math.floor(b / COLS), bc = b % COLS;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

export const memoryRace = defineGame<S>({
  id: 'memory-race',
  botDelay: [500, 1000],
  setup(ctx) {
    const path = makePath(ctx);
    const pos: Record<string, number> = {};
    for (const id of ctx.ids) pos[id] = path[0];
    return { path, pathSet: new Set(path), start: path[0], traps: [], pos, stunned: {}, best: Object.fromEntries(ctx.ids.map((id) => [id, 0])), finished: [], phase: 'preview', previewUntil: 0, endsAt: 0, falls: Object.fromEntries(ctx.ids.map((id) => [id, 0])) };
  },
  start(s, ctx) {
    const pv = ctx.ms(ctx.diff(5000, 3800, 2800));
    s.previewUntil = ctx.now() + pv;
    ctx.after(pv, () => {
      s.phase = 'race';
      s.endsAt = ctx.now() + ctx.ms(LIMIT);
      ctx.dirty();
      ctx.after(ctx.ms(LIMIT), () => ctx.end());
    });
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'step' || s.phase !== 'race' || s.finished.includes(pid)) return;
    if ((s.stunned[pid] ?? 0) > ctx.now()) return;
    const cell = int(a.cell, 0, COLS * ROWS - 1);
    if (cell == null || !adjacent(s.pos[pid], cell)) return;
    ctx.markActed(pid);
    if (s.pathSet.has(cell)) {
      s.pos[pid] = cell;
      s.best[pid] = Math.max(s.best[pid], s.path.indexOf(cell));
      if (cell === s.path[s.path.length - 1]) {
        s.finished.push(pid);
        ctx.event('finish', { place: s.finished.length }, pid);
        if (ctx.ids.every((id) => s.finished.includes(id) || !ctx.isConnected(id))) ctx.after(800, () => ctx.end());
      }
    } else {
      if (!s.traps.includes(cell)) s.traps.push(cell);
      s.pos[pid] = s.start;
      s.stunned[pid] = ctx.now() + 900;
      s.falls[pid]++;
      ctx.event('trap', { cell }, pid);
    }
  },
  pub(s) {
    return { cols: COLS, rows: ROWS, phase: s.phase, preview: s.phase === 'preview' ? s.path : null, previewUntil: s.previewUntil, start: s.start, goalRow: 0, traps: s.traps, pos: s.pos, finished: s.finished, endsAt: s.endsAt, best: s.best, pathLen: s.path.length };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'race' || s.finished.includes(pid) || (s.stunned[pid] ?? 0) > ctx.now()) return null;
    const cur = s.pos[pid];
    const idx = s.path.indexOf(cur);
    const right = s.path[idx + 1];
    const skill = ctx.diff(0.72, 0.82, 0.92);
    if (Math.random() < skill || right == null) return { action: { t: 'step', cell: right ?? cur } };
    const r = Math.floor(cur / COLS), c = cur % COLS;
    const opts = [[r - 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < COLS).map(([rr, cc]) => rr * COLS + cc).filter((x) => !s.traps.includes(x));
    return { action: { t: 'step', cell: ctx.rng.pick(opts.length ? opts : [right]) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const L = s.path.length - 1;
    for (const id of ctx.ids) {
      const place = s.finished.indexOf(id);
      const score = place >= 0 ? 1000 - place : s.best[id];
      perfs[id] = { score, perf: place >= 0 ? 0.7 + 0.3 * Math.max(0, 1 - place / ctx.ids.length) : (s.best[id] / L) * 0.6, participated: ctx.acted(id), bonuses: s.falls[id] === 0 && place >= 0 ? [{ label: 'Perfect path', pts: 40 }] : [], highlight: place >= 0 ? `Finished #${place + 1} · ${s.falls[id]} falls` : `${s.best[id]}/${L} steps · ${s.falls[id]} falls` };
    }
    return { perfs };
  },
});
