// Nonsense Sentence: a sentence with a blank; play the funniest card from your hand. Everyone
// votes for the best completion (not their own). Five sentences.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj } from '../../engine/util';
import { NONSENSE_CARDS, NONSENSE_PROMPTS } from '../../content/weird';

const ROUNDS = 5;
const HAND = 6;
const PLAY_MS = 25_000;
const VOTE_MS = 18_000;
const RESULT_MS = 5000;

interface S {
  r: number;
  phase: 'play' | 'vote' | 'result';
  deadline: number;
  prompts: string[];
  deck: string[];
  hands: Record<string, string[]>;
  played: Record<string, string>;
  order: string[];
  votes: Record<string, string>;
  scores: Record<string, number>;
  wins: Record<string, number>;
  timer: number | null;
}

export const nonsenseSentence = defineGame<S>({
  id: 'nonsense-sentence',
  botDelay: [2000, 6000],
  setup(ctx) {
    const deck = ctx.rng.shuffle(NONSENSE_CARDS);
    const hands: Record<string, string[]> = {};
    for (const id of ctx.ids) hands[id] = deck.splice(0, HAND);
    return {
      r: -1,
      phase: 'play',
      deadline: 0,
      prompts: ctx.rng.sample(NONSENSE_PROMPTS, ROUNDS),
      deck,
      hands,
      played: {},
      order: [],
      votes: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      wins: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'play' && s.phase === 'play' && !s.played[pid]) {
      const i = a.i;
      const hand = s.hands[pid];
      if (!hand || typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= hand.length) return;
      ctx.markActed(pid);
      s.played[pid] = hand[i];
      hand.splice(i, 1);
      if (s.deck.length) hand.push(s.deck.shift()!);
      if (allDone(ctx, (id) => !!s.played[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => toVote(s, ctx));
      }
      ctx.dirty();
    } else if (a.t === 'vote' && s.phase === 'vote' && !s.votes[pid]) {
      if (typeof a.target !== 'string' || !s.played[a.target] || a.target === pid) return;
      ctx.markActed(pid);
      s.votes[pid] = a.target;
      if (allDone(ctx, (id) => !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => tally(s, ctx));
      }
      ctx.dirty();
    }
  },
  pub(s) {
    const t: Record<string, number> = {};
    for (const v of Object.values(s.votes)) t[v] = (t[v] ?? 0) + 1;
    return {
      r: s.r,
      n: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      prompt: s.prompts[s.r],
      playedBy: Object.keys(s.played),
      entries: s.phase === 'play' ? [] : s.order.map((id) => ({ key: id, id: s.phase === 'result' ? id : null, card: s.played[id] })),
      voted: Object.keys(s.votes),
      tally: s.phase === 'result' ? t : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { hand: s.hands[pid] ?? [], mine: s.played[pid] ?? null, myVote: s.votes[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'play' && !s.played[pid]) return { action: { t: 'play', i: Math.floor(Math.random() * (s.hands[pid]?.length ?? 1)) } };
    if (s.phase === 'vote' && !s.votes[pid]) {
      const opts = s.order.filter((id) => id !== pid);
      if (opts.length) return { action: { t: 'vote', target: opts[Math.floor(Math.random() * opts.length)] } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const best = Math.max(1, ...Object.values(s.scores));
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / best),
        participated: ctx.acted(id),
        highlight: `${Math.round(s.scores[id] / 100)} vote${Math.round(s.scores[id] / 100) === 1 ? '' : 's'} · won ${s.wins[id]} sentence${s.wins[id] === 1 ? '' : 's'}`,
      };
    }
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.r++;
  if (s.r >= ROUNDS) return ctx.end();
  s.phase = 'play';
  s.played = {};
  s.votes = {};
  s.order = [];
  s.deadline = ctx.now() + ctx.ms(PLAY_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(PLAY_MS), () => toVote(s, ctx));
  ctx.dirty();
}

function toVote(s: S, ctx: GameCtx) {
  if (s.phase !== 'play') return;
  s.order = ctx.rng.shuffle(Object.keys(s.played));
  if (s.order.length < 2) return tally(s, ctx);
  s.phase = 'vote';
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => tally(s, ctx));
  ctx.dirty();
}

function tally(s: S, ctx: GameCtx) {
  if (s.phase === 'result') return;
  const t: Record<string, number> = {};
  for (const v of Object.values(s.votes)) t[v] = (t[v] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(t));
  for (const [id, n] of Object.entries(t)) {
    s.scores[id] += n * 100;
    if (n === max && max > 0) s.wins[id]++;
  }
  s.phase = 'result';
  s.deadline = ctx.now() + RESULT_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(RESULT_MS, () => next(s, ctx));
}
