import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, str } from '../../engine/util';
import { matchAnswer } from '@shared/validation';
import { RIDDLES } from '../../content/puzzles';

const COUNT = 5;
const RIDDLE_MS = 32_000;

interface S {
  i: number;
  list: { q: string; a: string[] }[];
  phase: 'play' | 'reveal';
  startedAt: number;
  deadline: number;
  hint: number; // 0..3
  solved: Record<string, number>;
  scores: Record<string, number>;
  count: Record<string, number>;
  last: Record<string, number>;
  timers: number[];
}

function mask(answer: string, level: number): string {
  // reveal letters progressively in a fixed order: first letter, then every 3rd, then every other
  return answer
    .split('')
    .map((c, k) => {
      if (c === ' ') return ' ';
      if (level >= 1 && k === 0) return c;
      if (level >= 2 && k % 3 === 0) return c;
      if (level >= 3 && k % 2 === 0) return c;
      return '_';
    })
    .join('');
}

export const riddleRace = defineGame<S>({
  id: 'riddle-race',
  botDelay: [2000, 4000],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, list: ctx.rng.sample(RIDDLES, COUNT), phase: 'play', startedAt: 0, deadline: 0, hint: 0, solved: {}, scores: z(), count: z(), last: {}, timers: [] };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'guess' || s.phase !== 'play' || s.solved[pid] != null) return;
    const g = str(a.g, 40);
    if (!g) return;
    const now = ctx.now();
    if (now - (s.last[pid] ?? 0) < 500) return;
    s.last[pid] = now;
    ctx.markActed(pid);
    const r = matchAnswer(g, s.list[s.i].a);
    if (r === 'exact') {
      const order = Object.keys(s.solved).length;
      s.solved[pid] = order;
      const pts = Math.max(30, 100 - s.hint * 18 - order * 6) + Math.round(40 * Math.max(0, 1 - (now - s.startedAt) / RIDDLE_MS));
      s.scores[pid] += pts;
      s.count[pid]++;
      ctx.event('solved', { pts }, pid);
      if (allDone(ctx, (id) => s.solved[id] != null)) {
        for (const t of s.timers) ctx.cancel(t);
        s.timers = [ctx.after(500, () => reveal(s, ctx))];
      }
    } else ctx.event(r === 'close' ? 'close' : 'wrong', { g }, pid);
  },
  pub(s) {
    const r = s.list[s.i];
    return { i: s.i, n: COUNT, riddle: r?.q ?? '', mask: r ? mask(r.a[0], s.hint) : '', hint: s.hint, phase: s.phase, deadline: s.deadline, solved: s.solved, answer: s.phase === 'reveal' ? r?.a[0] : null, scores: s.scores };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'play' || s.solved[pid] != null) return null;
    if (ctx.now() - s.startedAt < 6000 || Math.random() > ctx.diff(0.12, 0.17, 0.25)) return null;
    return { action: { t: 'guess', g: Math.random() < 0.75 ? s.list[s.i].a[0] : 'banana' } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.scores[id] / (COUNT * 120), participated: ctx.acted(id), bonuses: s.count[id] === COUNT ? [{ label: 'Riddle master', pts: 50 }] : [], highlight: `${s.count[id]}/${COUNT} riddles solved` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= COUNT) return ctx.end();
  s.phase = 'play';
  s.solved = {};
  s.hint = 0;
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + ctx.ms(RIDDLE_MS);
  s.timers = [
    ctx.after(ctx.ms(10000), () => { s.hint = 1; ctx.dirty(); }),
    ctx.after(ctx.ms(18000), () => { s.hint = 2; ctx.dirty(); }),
    ctx.after(ctx.ms(25000), () => { s.hint = 3; ctx.dirty(); }),
    ctx.after(ctx.ms(RIDDLE_MS), () => reveal(s, ctx)),
  ];
}

function reveal(s: S, ctx: GameCtx) {
  s.phase = 'reveal';
  ctx.dirty();
  s.timers = [ctx.after(3000, () => next(s, ctx))];
}
