import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int, allDone } from '../../engine/util';

// Groups of look-alikes make later rounds sneaky.
const POOL = [
  '🍎', '🍅', '🍒', '🍓', '🫐', '🍇', '🍋', '🍌', '🥝', '🍐', '🍏', '🥑', '🌶️', '🥕', '🌽', '🍄',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '⭐', '🌟', '✨', '⚡', '🔥', '💧', '❄️', '🌈', '☀️', '🌙', '☁️', '🌸', '🌻', '🌵', '🍀', '🌴',
  '🚗', '🚕', '🚙', '🚌', '🚀', '✈️', '🚲', '⛵', '🎈', '🎁', '🎀', '🧸', '🎲', '🧩', '🎯', '🎸',
];
const ROUNDS = 12;

interface S {
  round: number;
  phase: 'find' | 'gap';
  target: string;
  grid: string[];
  cols: number;
  found: Record<string, number>; // order index
  frozen: Record<string, number>;
  scores: Record<string, number>;
  deadline: number;
  startedAt: number;
  timer: number | null;
  times: Record<string, number[]>;
}

export const tapSymbol = defineGame<S>({
  id: 'tap-symbol',
  botDelay: [300, 700],
  setup(ctx) {
    return { round: -1, phase: 'gap', target: '', grid: [], cols: 3, found: {}, frozen: {}, scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])), deadline: 0, startedAt: 0, timer: null, times: Object.fromEntries(ctx.ids.map((id) => [id, []])) };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap' || s.phase !== 'find' || s.found[pid] != null) return;
    if ((s.frozen[pid] ?? 0) > ctx.now()) return;
    const i = int(a.i, 0, s.grid.length - 1);
    if (i == null) return;
    ctx.markActed(pid);
    if (s.grid[i] === s.target) {
      const order = Object.keys(s.found).length;
      s.found[pid] = order;
      const el = ctx.now() - s.startedAt;
      s.times[pid].push(el);
      s.scores[pid] += Math.max(40, 100 - order * 15) + Math.max(0, Math.round(40 - el / 150));
      if (allDone(ctx, (id) => s.found[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => gap(s, ctx));
      }
    } else {
      s.frozen[pid] = ctx.now() + 1000;
      ctx.event('freeze', { until: s.frozen[pid] }, pid);
    }
  },
  pub(s) {
    return { round: s.round, n: ROUNDS, phase: s.phase, target: s.target, grid: s.grid, cols: s.cols, found: s.found, deadline: s.deadline, scores: s.scores };
  },
  priv(s, _ctx, pid) {
    return { frozenUntil: s.frozen[pid] ?? 0 };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'find' || s.found[pid] != null) return null;
    if (ctx.now() - s.startedAt < ctx.diff(2600, 1900, 1300) + Math.random() * 1200) return null;
    const correct = s.grid.indexOf(s.target);
    const i = Math.random() < 0.85 ? correct : ctx.rng.int(0, s.grid.length - 1);
    return { action: { t: 'tap', i } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const t = s.times[id];
      const avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
      perfs[id] = { score: s.scores[id], perf: s.scores[id] / (ROUNDS * 120), participated: ctx.acted(id), highlight: `${t.length}/${ROUNDS} found${t.length ? ` · avg ${(avg / 1000).toFixed(1)} s` : ''}` };
    }
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS) return ctx.end();
  const cols = s.round < 3 ? 3 : s.round < 7 ? 4 : 5;
  const n = cols * cols;
  const pool = ctx.rng.shuffle(POOL);
  s.target = pool[0];
  const rest = pool.slice(1, n); // all different symbols
  const grid = ctx.rng.shuffle([s.target, ...rest]);
  s.grid = grid;
  s.cols = cols;
  s.found = {};
  s.frozen = {};
  s.phase = 'find';
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + ctx.ms(ctx.diff(10000, 8000, 6500));
  s.timer = ctx.after(s.deadline - s.startedAt, () => gap(s, ctx));
}

function gap(s: S, ctx: GameCtx) {
  s.phase = 'gap';
  ctx.dirty();
  s.timer = ctx.after(1200, () => next(s, ctx));
}
