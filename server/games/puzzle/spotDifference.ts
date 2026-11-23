import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const COLS = 6;
const ROWS = 4;
const DIFFS = 5;
const SCENES = 3;
const SCENE_MS = 40_000;
const OBJECTS = ['🌳', '🏠', '🚗', '🐱', '🐶', '🌸', '⭐', '🍎', '🎈', '☁️', '🐟', '🍄', '🚲', '⛵', '🦆', '🌻', '🪁', '🐌', '🍦', '🎁', '🧸', '🌵', '🐝', '🦋'];
const TINTS = 6;

interface Cell {
  e: string | null;
  t: number;
  f: 0 | 1;
  s: 0 | 1;
}
interface S {
  scene: number;
  left: Cell[];
  right: Cell[];
  diffs: number[];
  startedAt: number;
  deadline: number;
  found: Record<string, number[]>;
  frozen: Record<string, number>;
  scores: Record<string, number>;
  total: Record<string, number>;
  phase: 'find' | 'reveal';
  timer: number | null;
}

function makeScene(ctx: GameCtx): { left: Cell[]; right: Cell[]; diffs: number[] } {
  const n = COLS * ROWS;
  const left: Cell[] = Array.from({ length: n }, () => ({ e: ctx.rng.chance(0.78) ? ctx.rng.pick(OBJECTS) : null, t: ctx.rng.int(0, TINTS - 1), f: 0 as const, s: 0 as const }));
  const right = left.map((c) => ({ ...c }));
  const diffs = ctx.rng.sample(Array.from({ length: n }, (_, i) => i), DIFFS);
  for (const i of diffs) {
    const c = right[i];
    const kinds = c.e ? ['swap', 'remove', 'tint', 'flip', 'size'] : ['add', 'tint'];
    const k = ctx.rng.pick(kinds);
    if (k === 'swap') c.e = ctx.rng.pick(OBJECTS.filter((o) => o !== c.e));
    else if (k === 'remove') c.e = null;
    else if (k === 'add') c.e = ctx.rng.pick(OBJECTS);
    else if (k === 'tint') c.t = (c.t + ctx.rng.int(1, TINTS - 1)) % TINTS;
    else if (k === 'flip') c.f = 1;
    else c.s = 1;
  }
  return { left, right, diffs };
}

export const spotDifference = defineGame<S>({
  id: 'spot-difference',
  botDelay: [1200, 3200],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { scene: -1, left: [], right: [], diffs: [], startedAt: 0, deadline: 0, found: {}, frozen: {}, scores: z(), total: z(), phase: 'find', timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap' || s.phase !== 'find') return;
    if ((s.frozen[pid] ?? 0) > ctx.now()) return;
    const i = int(a.i, 0, COLS * ROWS - 1);
    if (i == null) return;
    ctx.markActed(pid);
    const mine = (s.found[pid] ??= []);
    if (mine.includes(i)) return;
    if (s.diffs.includes(i)) {
      mine.push(i);
      const el = ctx.now() - s.startedAt;
      s.scores[pid] += 30 + Math.round(20 * Math.max(0, 1 - el / SCENE_MS));
      s.total[pid]++;
      if (mine.length === DIFFS) s.scores[pid] += 20;
      if (ctx.ids.every((id) => (s.found[id]?.length ?? 0) === DIFFS || !ctx.isConnected(id))) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(500, () => reveal(s, ctx));
      }
    } else {
      s.frozen[pid] = ctx.now() + 1200;
      ctx.event('wrong', { i }, pid);
    }
  },
  pub(s) {
    return {
      scene: s.scene,
      n: SCENES,
      cols: COLS,
      left: s.left,
      right: s.right,
      deadline: s.deadline,
      phase: s.phase,
      counts: Object.fromEntries(Object.entries(s.found).map(([id, f]) => [id, f.length])),
      diffs: s.phase === 'reveal' ? s.diffs : null,
      total: DIFFS,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { found: s.found[pid] ?? [], frozenUntil: s.frozen[pid] ?? 0 };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'find') return null;
    const mine = s.found[pid] ?? [];
    const left = s.diffs.filter((d) => !mine.includes(d));
    if (!left.length) return null;
    const i = Math.random() < ctx.diff(0.6, 0.72, 0.85) ? ctx.rng.pick(left) : ctx.rng.int(0, COLS * ROWS - 1);
    return { action: { t: 'tap', i } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.total[id] / (DIFFS * SCENES), participated: ctx.acted(id), bonuses: s.total[id] === DIFFS * SCENES ? [{ label: 'Eagle eyes', pts: 40 }] : [], highlight: `${s.total[id]}/${DIFFS * SCENES} differences` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.scene++;
  if (s.scene >= SCENES) return ctx.end();
  const sc = makeScene(ctx);
  s.left = sc.left;
  s.right = sc.right;
  s.diffs = sc.diffs;
  s.found = {};
  s.frozen = {};
  s.phase = 'find';
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + ctx.ms(SCENE_MS);
  s.timer = ctx.after(ctx.ms(SCENE_MS), () => reveal(s, ctx));
}

function reveal(s: S, ctx: GameCtx) {
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(2800, () => next(s, ctx));
}
