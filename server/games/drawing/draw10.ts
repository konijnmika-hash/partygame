// Draw in 10 Seconds: simultaneous head-to-head sketch duels judged by everyone.
import { defineGame, type GameCtx } from '../../engine/types';
import { CanvasStore, botScribble } from '../../engine/drawing';
import { allDone, isObj, int } from '../../engine/util';
import { DRAW_WORDS_EASY, DRAW_WORDS_MEDIUM } from '../../content/drawing';

const ROUNDS = 3;
const DRAW_MS = 10_500;
const VOTE_MS = 20_000;

interface S {
  round: number;
  prompts: string[];
  groups: string[][];
  phase: 'ready' | 'draw' | 'vote' | 'result';
  deadline: number;
  canvas: CanvasStore;
  votes: Record<string, Record<number, string>>; // voter -> group -> pick
  scores: Record<string, number>;
  wins: Record<string, number>;
  received: Record<string, number>;
  timer: number | null;
  botSeq: number;
}

const cv = (r: number, pid: string) => `d10:${r}:${pid}`;

export const draw10 = defineGame<S>({
  id: 'draw-10',
  botDelay: [500, 1200],
  setup(ctx) {
    const pool = [...DRAW_WORDS_EASY, ...DRAW_WORDS_MEDIUM];
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { round: -1, prompts: ctx.rng.sample(pool, ROUNDS), groups: [], phase: 'ready', deadline: 0, canvas: new CanvasStore(), votes: {}, scores: z(), wins: z(), received: z(), timer: null, botSeq: 1 };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (s.phase === 'draw' && (a.t === 'draw' || a.t === 'undo' || a.t === 'clear') && a.cv === cv(s.round, pid)) {
      if (s.canvas.apply(pid, a)) ctx.markActed(pid);
      return;
    }
    if (s.phase === 'vote' && a.t === 'vote') {
      const g = int(a.g, 0, s.groups.length - 1);
      if (g == null || typeof a.target !== 'string' || !s.groups[g].includes(a.target) || a.target === pid) return;
      const mine = (s.votes[pid] ??= {});
      if (mine[g]) return;
      ctx.markActed(pid);
      mine[g] = a.target;
      const complete = (id: string) => s.groups.every((grp, gi) => !!s.votes[id]?.[gi] || grp.every((m) => m === id) || grp.filter((m) => m !== id).length === 0);
      if (allDone(ctx, complete)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => result(s, ctx));
      }
    }
  },
  pub(s) {
    return { round: s.round, n: ROUNDS, prompt: s.prompts[s.round], groups: s.groups, phase: s.phase, deadline: s.deadline, voted: Object.keys(s.votes), tally: s.phase === 'result' ? countVotes(s) : null, scores: s.scores };
  },
  priv(s, _ctx, pid) {
    return { myVotes: s.votes[pid] ?? {}, cv: cv(s.round, pid) };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'draw') return { action: botScribble(cv(s.round, pid), s.botSeq++, Math.random) };
    if (s.phase === 'vote') {
      const mine = s.votes[pid] ?? {};
      const g = s.groups.findIndex((grp, gi) => !mine[gi] && grp.some((m) => m !== pid));
      if (g < 0) return null;
      return { action: { t: 'vote', g, target: ctx.rng.pick(s.groups[g].filter((m) => m !== pid)) } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.wins[id] / ROUNDS) * 0.7 + Math.min(1, s.received[id] / (ROUNDS * Math.max(1, ctx.ids.length - 2))) * 0.3, participated: ctx.acted(id), highlight: `${s.wins[id]}/${ROUNDS} duels won · ${s.received[id]} votes` };
    return { perfs };
  },
});

function countVotes(s: S): Record<string, number> {
  const out: Record<string, number> = {};
  for (const byGroup of Object.values(s.votes)) for (const t of Object.values(byGroup)) out[t] = (out[t] ?? 0) + 1;
  return out;
}

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS) return ctx.end();
  const order = ctx.rng.shuffle(ctx.ids);
  const groups: string[][] = [];
  for (let i = 0; i < order.length; i += 2) groups.push(order.slice(i, i + 2));
  if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(groups.pop()![0]);
  s.groups = groups;
  s.votes = {};
  s.phase = 'ready';
  s.deadline = ctx.now() + 3000;
  ctx.dirty();
  s.timer = ctx.after(3000, () => {
    s.phase = 'draw';
    s.deadline = ctx.now() + DRAW_MS;
    ctx.dirty();
    s.timer = ctx.after(DRAW_MS, () => {
      const gallery: Record<string, unknown> = {};
      for (const id of ctx.ids) gallery[id] = s.canvas.snapshot(cv(s.round, id));
      ctx.asset(`d10:gallery:${s.round}`, gallery);
      s.phase = 'vote';
      s.deadline = ctx.now() + ctx.ms(VOTE_MS);
      ctx.dirty();
      s.timer = ctx.after(ctx.ms(VOTE_MS), () => result(s, ctx));
    });
  });
}

function result(s: S, ctx: GameCtx) {
  const counts = countVotes(s);
  for (const grp of s.groups) {
    const max = Math.max(0, ...grp.map((m) => counts[m] ?? 0));
    for (const m of grp) {
      const n = counts[m] ?? 0;
      s.scores[m] += n * 40;
      s.received[m] += n;
      if (n === max && max > 0) {
        s.scores[m] += 70;
        s.wins[m]++;
      }
    }
  }
  s.phase = 'result';
  ctx.dirty();
  s.timer = ctx.after(4500, () => next(s, ctx));
}
