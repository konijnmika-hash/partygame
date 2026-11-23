import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, str, tally } from '../../engine/util';
import { BOT_ANSWERS, IMPOSTOR_PAIRS } from '../../content/social';

const ROUNDS = 3;
const ANSWER_MS = 30_000;
const DISCUSS_MS = 22_000;
const VOTE_MS = 16_000;

interface S {
  round: number;
  pairs: [string, string][];
  impostors: string[];
  phase: 'answer' | 'discuss' | 'vote' | 'reveal';
  answers: Record<string, string>;
  votes: Record<string, string>;
  deadline: number;
  scores: Record<string, number>;
  caughtBy: Record<string, number>;
  survived: Record<string, number>;
  outcome: { impostor: string; caught: boolean; counts: Record<string, number> } | null;
  ready: Record<string, boolean>;
  timer: number | null;
}

export const secretImpostor = defineGame<S>({
  id: 'secret-impostor',
  botDelay: [2000, 5000],
  setup(ctx) {
    const order = ctx.rng.shuffle(ctx.ids);
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { round: -1, pairs: ctx.rng.sample(IMPOSTOR_PAIRS, ROUNDS), impostors: Array.from({ length: ROUNDS }, (_, i) => order[i % order.length]), phase: 'answer', answers: {}, votes: {}, deadline: 0, scores: z(), caughtBy: z(), survived: z(), outcome: null, ready: {}, timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'answer' && s.phase === 'answer' && !s.answers[pid]) {
      const v = str(a.v, 40);
      if (!v) return;
      ctx.markActed(pid);
      s.answers[pid] = v;
      if (allDone(ctx, (id) => !!s.answers[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => discuss(s, ctx));
      }
    } else if (a.t === 'vote' && s.phase === 'vote' && !s.votes[pid]) {
      if (typeof a.target !== 'string' || !ctx.isPlayer(a.target) || a.target === pid) return;
      ctx.markActed(pid);
      s.votes[pid] = a.target;
      if (allDone(ctx, (id) => !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    } else if (a.t === 'ready' && s.phase === 'discuss') {
      // everyone ready to vote skips the rest of the discussion
      s.ready[pid] = true;
      if (allDone(ctx, (id) => !!s.ready[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(200, () => vote(s, ctx));
      }
    }
  },
  pub(s) {
    const crewQ = s.pairs[s.round]?.[0];
    return {
      round: s.round,
      n: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      answered: Object.keys(s.answers),
      answers: s.phase === 'answer' ? null : s.answers,
      crewQuestion: s.phase === 'answer' ? null : crewQ,
      voted: Object.keys(s.votes),
      outcome: s.phase === 'reveal' ? { ...s.outcome, impostorQuestion: s.pairs[s.round][1], votes: s.votes } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const pair = s.pairs[s.round];
    if (!pair) return null;
    const imp = s.impostors[s.round] === pid;
    // the impostor does NOT know they are the impostor — they just get a different question
    return { question: imp ? pair[1] : pair[0], myAnswer: s.answers[pid] ?? null, myVote: s.votes[pid] ?? null, wasImpostor: s.phase === 'reveal' ? imp : null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'answer' && !s.answers[pid]) return { action: { t: 'answer', v: ctx.rng.chance(0.6) ? String(ctx.rng.int(1, 12)) : ctx.rng.pick(BOT_ANSWERS) } };
    if (s.phase === 'discuss') return { action: { t: 'ready' } };
    if (s.phase === 'vote' && !s.votes[pid]) return { action: { t: 'vote', target: ctx.rng.pick(ctx.ids.filter((id) => id !== pid)) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.scores[id] / (ROUNDS * 120)), participated: ctx.acted(id), highlight: `Caught the impostor ${s.caughtBy[id]}× · escaped ${s.survived[id]}×` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS) return ctx.end();
  s.phase = 'answer';
  s.answers = {};
  s.votes = {};
  s.ready = {};
  s.outcome = null;
  s.deadline = ctx.now() + ctx.ms(ANSWER_MS);
  s.timer = ctx.after(ctx.ms(ANSWER_MS), () => discuss(s, ctx));
  ctx.dirty();
}

function discuss(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) if (!s.answers[id]) s.answers[id] = '🤐 (no answer)';
  s.phase = 'discuss';
  s.deadline = ctx.now() + ctx.ms(DISCUSS_MS);
  s.timer = ctx.after(ctx.ms(DISCUSS_MS), () => vote(s, ctx));
  ctx.dirty();
}

function vote(s: S, ctx: GameCtx) {
  s.phase = 'vote';
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const imp = s.impostors[s.round];
  const counts = tally(s.votes);
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  const caught = max > 0 && top.length === 1 && top[0] === imp;
  for (const [voter, target] of Object.entries(s.votes)) {
    if (target === imp && voter !== imp) {
      s.scores[voter] += 100;
      s.caughtBy[voter]++;
    }
  }
  if (!caught) {
    s.scores[imp] += 250;
    s.survived[imp]++;
  }
  s.outcome = { impostor: imp, caught, counts };
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(6000, () => next(s, ctx));
}

