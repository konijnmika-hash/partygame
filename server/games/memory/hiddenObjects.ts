import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const POOL = ['🔑', '🧦', '🍌', '🕶️', '📎', '🧲', '🎲', '🪀', '🧩', '🖍️', '🔔', '🪁', '🎺', '🥄', '🧽', '🪣', '🧯', '🔦', '🪥', '🧤', '🎀', '🪙', '🥕', '🐌', '🦀', '🌶️', '🍪', '🧁', '🍭', '🥨', '🦋', '🐞', '🕹️', '📌', '🧸', '🪶', '🍄', '🌂', '🎁', '⏰'];
const COLS = 8;
const ROWS = 6;
const TARGETS = 5;
const SCENES = 2;
const SCENE_MS = 45_000;

interface S {
  scene: number;
  cells: (string | null)[];
  targets: string[];
  phase: 'memorize' | 'find' | 'reveal';
  memorizeUntil: number;
  deadline: number;
  found: Record<string, number[]>;
  frozen: Record<string, number>;
  peekUntil: Record<string, number>;
  scores: Record<string, number>;
  total: Record<string, number>;
  timer: number | null;
}

function makeScene(ctx: GameCtx): { cells: (string | null)[]; targets: string[] } {
  const n = COLS * ROWS;
  const targets = ctx.rng.sample(POOL, TARGETS);
  const fillers = POOL.filter((p) => !targets.includes(p));
  const cells: (string | null)[] = Array.from({ length: n }, () => (ctx.rng.chance(0.85) ? ctx.rng.pick(fillers) : null));
  const spots = ctx.rng.sample(Array.from({ length: n }, (_, i) => i), TARGETS);
  targets.forEach((t, k) => (cells[spots[k]] = t));
  return { cells, targets };
}

export const hiddenObjects = defineGame<S>({
  id: 'hidden-objects',
  botDelay: [1500, 3500],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { scene: -1, cells: [], targets: [], phase: 'memorize', memorizeUntil: 0, deadline: 0, found: {}, frozen: {}, peekUntil: {}, scores: z(), total: z(), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || s.phase !== 'find') return;
    if (a.t === 'peek') {
      s.peekUntil[pid] = ctx.now() + 1500;
      s.scores[pid] -= 10;
      ctx.markActed(pid);
      ctx.after(1550, () => ctx.dirty());
      return;
    }
    if (a.t !== 'tap' || (s.frozen[pid] ?? 0) > ctx.now()) return;
    const i = int(a.i, 0, s.cells.length - 1);
    if (i == null) return;
    ctx.markActed(pid);
    const mine = (s.found[pid] ??= []);
    const e = s.cells[i];
    if (e && s.targets.includes(e) && !mine.includes(i)) {
      mine.push(i);
      s.total[pid]++;
      s.scores[pid] += 40 + Math.round(30 * Math.max(0, 1 - (ctx.now() - s.memorizeUntil) / SCENE_MS));
      if (mine.length === TARGETS) {
        s.scores[pid] += 25;
        if (ctx.ids.every((id) => (s.found[id]?.length ?? 0) === TARGETS || !ctx.isConnected(id))) {
          ctx.cancel(s.timer);
          s.timer = ctx.after(500, () => reveal(s, ctx));
        }
      }
    } else {
      s.frozen[pid] = ctx.now() + 1000;
      ctx.event('wrong', { i }, pid);
    }
  },
  pub(s) {
    return {
      scene: s.scene,
      n: SCENES,
      cols: COLS,
      cells: s.cells,
      phase: s.phase,
      memorizeUntil: s.memorizeUntil,
      deadline: s.deadline,
      targets: s.phase === 'memorize' || s.phase === 'reveal' ? s.targets : null,
      counts: Object.fromEntries(Object.entries(s.found).map(([id, f]) => [id, f.length])),
      scores: s.scores,
      total: TARGETS,
    };
  },
  priv(s, ctx, pid) {
    const peek = (s.peekUntil[pid] ?? 0) > ctx.now();
    const mine = s.found[pid] ?? [];
    return { found: mine, foundEmoji: mine.map((i) => s.cells[i]), frozenUntil: s.frozen[pid] ?? 0, peek: peek ? s.targets : null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'find') return null;
    const mine = s.found[pid] ?? [];
    const left = s.cells.map((e, i) => (e && s.targets.includes(e) && !mine.includes(i) ? i : -1)).filter((i) => i >= 0);
    if (!left.length) return null;
    return { action: { t: 'tap', i: Math.random() < ctx.diff(0.55, 0.7, 0.85) ? ctx.rng.pick(left) : ctx.rng.int(0, s.cells.length - 1) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.total[id] / (TARGETS * SCENES), participated: ctx.acted(id), highlight: `${s.total[id]}/${TARGETS * SCENES} found` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.scene++;
  if (s.scene >= SCENES) return ctx.end();
  const sc = makeScene(ctx);
  s.cells = sc.cells;
  s.targets = sc.targets;
  s.found = {};
  s.frozen = {};
  s.peekUntil = {};
  s.phase = 'memorize';
  const mem = ctx.ms(ctx.diff(5000, 4000, 3000));
  s.memorizeUntil = ctx.now() + mem;
  s.timer = ctx.after(mem, () => {
    s.phase = 'find';
    s.deadline = ctx.now() + ctx.ms(SCENE_MS);
    ctx.dirty();
    s.timer = ctx.after(ctx.ms(SCENE_MS), () => reveal(s, ctx));
  });
}

function reveal(s: S, ctx: GameCtx) {
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(2600, () => next(s, ctx));
}
