import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int, str, tally } from '../../engine/util';
import { BOT_CLUES, SECRET_CATEGORIES } from '../../content/social';
import { normalizeAnswer } from '@shared/validation';

const ROUNDS = 2;
const CLUE_MS = 35_000;
const VOTE_MS = 20_000;
const GUESS_MS = 15_000;

interface S {
  round: number;
  cats: typeof SECRET_CATEGORIES;
  spies: string[];
  word: number;
  phase: 'clue' | 'vote' | 'spyguess' | 'reveal';
  clues: Record<string, string>;
  votes: Record<string, string>;
  spyGuess: number | null;
  caught: boolean;
  deadline: number;
  scores: Record<string, number>;
  timer: number | null;
}

export const secretWord = defineGame<S>({
  id: 'secret-word',
  botDelay: [2000, 5000],
  setup(ctx) {
    const order = ctx.rng.shuffle(ctx.ids);
    return { round: -1, cats: ctx.rng.sample(SECRET_CATEGORIES, ROUNDS), spies: [order[0], order[1 % order.length]], word: 0, phase: 'clue', clues: {}, votes: {}, spyGuess: null, caught: false, deadline: 0, scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const spy = s.spies[s.round];
    if (a.t === 'clue' && s.phase === 'clue' && !s.clues[pid]) {
      const v = str(a.v, 24);
      if (!v) return;
      const word = s.cats[s.round].words[s.word];
      // giving away the word itself is not allowed
      if (normalizeAnswer(v) === normalizeAnswer(word)) return ctx.event('nope', { why: "You can't say the word itself!" }, pid);
      ctx.markActed(pid);
      s.clues[pid] = v.split(' ')[0];
      if (allDone(ctx, (id) => !!s.clues[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => vote(s, ctx));
      }
    } else if (a.t === 'vote' && s.phase === 'vote' && !s.votes[pid]) {
      if (typeof a.target !== 'string' || !ctx.isPlayer(a.target) || a.target === pid) return;
      ctx.markActed(pid);
      s.votes[pid] = a.target;
      if (allDone(ctx, (id) => !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => tallyVotes(s, ctx));
      }
    } else if (a.t === 'spyguess' && s.phase === 'spyguess' && pid === spy && s.spyGuess == null) {
      const c = int(a.c, 0, s.cats[s.round].words.length - 1);
      if (c == null) return;
      ctx.markActed(pid);
      s.spyGuess = c;
      ctx.cancel(s.timer);
      s.timer = ctx.after(200, () => reveal(s, ctx));
    }
  },
  pub(s) {
    const cat = s.cats[s.round];
    return {
      round: s.round,
      n: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      category: cat?.name,
      words: cat?.words,
      cluesGiven: Object.keys(s.clues),
      clues: s.phase === 'clue' ? null : s.clues,
      voted: Object.keys(s.votes),
      caughtSpy: s.phase === 'spyguess' || s.phase === 'reveal' ? (s.caught ? s.spies[s.round] : null) : null,
      reveal: s.phase === 'reveal' ? { spy: s.spies[s.round], word: s.word, votes: s.votes, caught: s.caught, spyGuess: s.spyGuess } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const isSpy = s.spies[s.round] === pid;
    return { isSpy, word: isSpy ? null : s.word, myClue: s.clues[pid] ?? null, myVote: s.votes[pid] ?? null };
  },
  bot(s, ctx, pid) {
    const spy = s.spies[s.round];
    if (s.phase === 'clue' && !s.clues[pid]) return { action: { t: 'clue', v: pid === spy ? ctx.rng.pick(BOT_CLUES) : ctx.rng.chance(0.5) ? s.cats[s.round].name.split(' ')[0].toLowerCase() : ctx.rng.pick(BOT_CLUES) } };
    if (s.phase === 'vote' && !s.votes[pid]) return { action: { t: 'vote', target: ctx.rng.pick(ctx.ids.filter((id) => id !== pid)) } };
    if (s.phase === 'spyguess' && pid === spy && s.spyGuess == null) return { action: { t: 'spyguess', c: ctx.rng.chance(0.25) ? s.word : ctx.rng.int(0, 15) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.scores[id] / (ROUNDS * 150)), participated: ctx.acted(id), highlight: `${s.scores[id]} spy-hunt points` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS) return ctx.end();
  s.word = ctx.rng.int(0, s.cats[s.round].words.length - 1);
  s.phase = 'clue';
  s.clues = {};
  s.votes = {};
  s.spyGuess = null;
  s.caught = false;
  s.deadline = ctx.now() + ctx.ms(CLUE_MS);
  s.timer = ctx.after(ctx.ms(CLUE_MS), () => vote(s, ctx));
  ctx.dirty();
}

function vote(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) if (!s.clues[id]) s.clues[id] = '...';
  s.phase = 'vote';
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => tallyVotes(s, ctx));
  ctx.dirty();
}

function tallyVotes(s: S, ctx: GameCtx) {
  const spy = s.spies[s.round];
  const counts = tally(s.votes);
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  s.caught = max > 0 && top.length === 1 && top[0] === spy;
  for (const [voter, target] of Object.entries(s.votes)) if (target === spy && voter !== spy) s.scores[voter] += 60;
  if (s.caught) {
    s.phase = 'spyguess';
    s.deadline = ctx.now() + ctx.ms(GUESS_MS);
    s.timer = ctx.after(ctx.ms(GUESS_MS), () => reveal(s, ctx));
    ctx.dirty();
  } else reveal(s, ctx);
}

function reveal(s: S, ctx: GameCtx) {
  const spy = s.spies[s.round];
  const crew = ctx.ids.filter((id) => id !== spy);
  if (!s.caught) s.scores[spy] += 300;
  else if (s.spyGuess === s.word) s.scores[spy] += 220;
  else for (const id of crew) s.scores[id] += 120;
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(6000, () => next(s, ctx));
}
