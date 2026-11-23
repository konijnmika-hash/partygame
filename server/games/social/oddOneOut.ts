import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int } from '../../engine/util';
import { ODD_SETS } from '../../content/social';

const SETS = 8;
const PICK_MS = 13_000;

interface S {
  i: number;
  sets: string[][];
  phase: 'pick' | 'reveal';
  picks: Record<string, number>;
  deadline: number;
  scores: Record<string, number>;
  matches: Record<string, number>;
  timer: number | null;
}

export const oddOneOut = defineGame<S>({
  id: 'odd-one-out',
  botDelay: [1200, 3500],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, sets: ctx.rng.sample(ODD_SETS, SETS).map((set) => ctx.rng.shuffle(set)), phase: 'pick', picks: {}, deadline: 0, scores: z(), matches: z(), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'pick' || s.phase !== 'pick' || s.picks[pid] != null) return;
    const c = int(a.c, 0, 3);
    if (c == null) return;
    ctx.markActed(pid);
    s.picks[pid] = c;
    if (allDone(ctx, (id) => s.picks[id] != null)) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(300, () => reveal(s, ctx));
    }
  },
  pub(s) {
    return { i: s.i, n: SETS, items: s.sets[s.i], phase: s.phase, deadline: s.deadline, picked: Object.keys(s.picks), reveal: s.phase === 'reveal' ? s.picks : null, scores: s.scores };
  },
  priv(s, _ctx, pid) {
    return { mine: s.picks[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'pick' || s.picks[pid] != null) return null;
    // bots favour the last item (often the "odd" one in the content) to create some consensus
    return { action: { t: 'pick', c: ctx.rng.chance(0.45) ? s.sets[s.i].length - 1 : ctx.rng.int(0, 3) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const others = Math.max(1, ctx.ids.length - 1);
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.matches[id] / (SETS * others), participated: ctx.acted(id), highlight: `Agreed with ${s.matches[id]} picks` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= SETS) return ctx.end();
  s.phase = 'pick';
  s.picks = {};
  s.deadline = ctx.now() + ctx.ms(PICK_MS);
  s.timer = ctx.after(ctx.ms(PICK_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const ids = Object.keys(s.picks);
  for (const id of ids) {
    const same = ids.filter((o) => o !== id && s.picks[o] === s.picks[id]).length;
    s.matches[id] += same;
    s.scores[id] += same * 30;
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(3500, () => next(s, ctx));
}

