import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj } from '../../engine/util';
import { BLUFF_STATEMENTS } from '../../content/social';

const CLAIM_MS = 12_000;
const VOTE_MS = 13_000;
const MAX_TURNS = 8;

interface S {
  order: string[];
  turn: number;
  statements: [string, boolean][];
  claim: boolean | null;
  phase: 'claim' | 'vote' | 'reveal';
  votes: Record<string, 'believe' | 'doubt'>;
  deadline: number;
  scores: Record<string, number>;
  reads: Record<string, number>;
  fooled: Record<string, number>;
  timer: number | null;
}

export const bluffChallenge = defineGame<S>({
  id: 'bluff-challenge',
  botDelay: [1500, 4000],
  setup(ctx) {
    const order = ctx.rng.shuffle(ctx.ids).slice(0, MAX_TURNS);
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { order, turn: -1, statements: ctx.rng.sample(BLUFF_STATEMENTS, order.length), claim: null, phase: 'claim', votes: {}, deadline: 0, scores: z(), reads: z(), fooled: z(), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const presenter = s.order[s.turn];
    if (a.t === 'claim' && s.phase === 'claim' && pid === presenter && typeof a.v === 'boolean') {
      ctx.markActed(pid);
      s.claim = a.v;
      ctx.cancel(s.timer);
      voting(s, ctx);
    } else if (a.t === 'vote' && s.phase === 'vote' && pid !== presenter && !s.votes[pid] && (a.v === 'believe' || a.v === 'doubt')) {
      ctx.markActed(pid);
      s.votes[pid] = a.v;
      if (allDone(ctx, (id) => id === presenter || !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s) {
    const st = s.statements[s.turn];
    return {
      turn: s.turn,
      n: s.order.length,
      presenter: s.order[s.turn],
      phase: s.phase,
      deadline: s.deadline,
      statement: s.phase === 'claim' ? null : st?.[0],
      claim: s.phase === 'claim' ? null : s.claim,
      voted: Object.keys(s.votes),
      reveal: s.phase === 'reveal' && st ? { truth: st[1], votes: s.votes } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const st = s.statements[s.turn];
    if (s.order[s.turn] === pid && st) return { presenter: true, statement: st[0], truth: st[1], myVote: null };
    return { presenter: false, statement: null, truth: null, myVote: s.votes[pid] ?? null };
  },
  bot(s, ctx, pid) {
    const presenter = s.order[s.turn];
    if (s.phase === 'claim' && pid === presenter) return { action: { t: 'claim', v: ctx.rng.chance(0.6) ? s.statements[s.turn][1] : !s.statements[s.turn][1] } };
    if (s.phase === 'vote' && pid !== presenter && !s.votes[pid]) return { action: { t: 'vote', v: ctx.rng.chance(0.55) ? 'believe' : 'doubt' } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const rounds = Math.max(1, s.order.length - 1);
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.reads[id] / rounds) * 0.7 + Math.min(1, s.fooled[id] / Math.max(1, ctx.ids.length - 1)) * 0.3, participated: ctx.acted(id), highlight: `Read ${s.reads[id]} correctly · fooled ${s.fooled[id]}` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.turn++;
  if (s.turn >= s.order.length) return ctx.end();
  s.phase = 'claim';
  s.claim = null;
  s.votes = {};
  s.deadline = ctx.now() + ctx.ms(CLAIM_MS);
  // presenter who stays silent automatically tells the truth
  s.timer = ctx.after(ctx.ms(CLAIM_MS), () => {
    s.claim = s.statements[s.turn][1];
    voting(s, ctx);
  });
  ctx.dirty();
}

function voting(s: S, ctx: GameCtx) {
  s.phase = 'vote';
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const presenter = s.order[s.turn];
  const honest = s.claim === s.statements[s.turn][1];
  for (const [voter, v] of Object.entries(s.votes)) {
    const correct = (v === 'believe') === honest;
    if (correct) {
      s.scores[voter] += 80;
      s.reads[voter]++;
    } else {
      s.scores[presenter] += 55;
      s.fooled[presenter]++;
    }
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(4800, () => next(s, ctx));
}
