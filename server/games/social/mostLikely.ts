import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, tally } from '../../engine/util';
import { MOST_LIKELY } from '../../content/social';

const PROMPTS = 6;
const VOTE_MS = 14_000;

interface S {
  i: number;
  prompts: string[];
  phase: 'vote' | 'reveal';
  votes: Record<string, string>;
  deadline: number;
  winners: string[];
  counts: Record<string, number>;
  scores: Record<string, number>;
  agreed: Record<string, number>;
  famous: Record<string, number>;
  timer: number | null;
}

export const mostLikely = defineGame<S>({
  id: 'most-likely',
  botDelay: [1500, 4000],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, prompts: ctx.rng.sample(MOST_LIKELY, PROMPTS), phase: 'vote', votes: {}, deadline: 0, winners: [], counts: {}, scores: z(), agreed: z(), famous: z(), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'vote' || s.phase !== 'vote' || s.votes[pid]) return;
    if (typeof a.target !== 'string' || !ctx.isPlayer(a.target) || a.target === pid) return;
    ctx.markActed(pid);
    s.votes[pid] = a.target;
    if (allDone(ctx, (id) => !!s.votes[id])) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(300, () => reveal(s, ctx));
    }
  },
  pub(s) {
    return { i: s.i, n: PROMPTS, prompt: s.prompts[s.i], phase: s.phase, deadline: s.deadline, voted: Object.keys(s.votes), reveal: s.phase === 'reveal' ? { counts: s.counts, winners: s.winners, votes: s.votes } : null, scores: s.scores, famous: s.famous };
  },
  priv(s, _ctx, pid) {
    return { myVote: s.votes[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'vote' || s.votes[pid]) return null;
    return { action: { t: 'vote', target: ctx.rng.pick(ctx.ids.filter((id) => id !== pid)) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.agreed[id] / PROMPTS, participated: ctx.acted(id), highlight: `Matched the majority ${s.agreed[id]}× · voted ${s.famous[id]}×` };
    const star = ctx.ids.reduce((b, id) => (s.famous[id] > s.famous[b] ? id : b), ctx.ids[0]);
    return { perfs, summary: s.famous[star] ? [`👉 Most pointed-at: ${ctx.name(star)} (${s.famous[star]} votes)`] : [] };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= PROMPTS) return ctx.end();
  s.phase = 'vote';
  s.votes = {};
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  s.counts = tally(s.votes);
  const max = Math.max(0, ...Object.values(s.counts));
  s.winners = max > 0 ? Object.keys(s.counts).filter((id) => s.counts[id] === max) : [];
  for (const [voter, target] of Object.entries(s.votes)) {
    if (s.winners.includes(target)) {
      s.scores[voter] += 100;
      s.agreed[voter]++;
    }
  }
  for (const [target, n] of Object.entries(s.counts)) {
    s.famous[target] += n;
    s.scores[target] += Math.min(45, n * 15);
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(4200, () => next(s, ctx));
}
