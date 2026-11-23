// Fake Artist: one stroke each on a shared canvas; find the player who doesn't know the word.
import { defineGame, type GameCtx } from '../../engine/types';
import { CanvasStore, botScribble, relay } from '../../engine/drawing';
import { allDone, isObj, str, tally } from '../../engine/util';
import { matchAnswer } from '@shared/validation';
import { SECRET_CATEGORIES } from '../../content/social';

const LAPS = 2;
const TURN_MS = 16_000;
const VOTE_MS = 25_000;
const GUESS_MS = 20_000;
const CV = 'fa';
const COLORS = [2, 7, 5, 9, 3, 8, 6, 12, 10, 13, 15, 4];

interface S {
  cat: (typeof SECRET_CATEGORIES)[number];
  word: string;
  fake: string;
  order: string[];
  turn: number;
  phase: 'draw' | 'vote' | 'guess' | 'reveal';
  deadline: number;
  canvas: CanvasStore;
  strokeKey: string | null;
  votes: Record<string, string>;
  caught: boolean;
  fakeGuess: string | null;
  fakeRight: boolean;
  scores: Record<string, number>;
  timer: number | null;
  botSeq: number;
  color: Record<string, number>;
}

export const fakeArtist = defineGame<S>({
  id: 'fake-artist',
  botDelay: [900, 2200],
  setup(ctx) {
    const cat = ctx.rng.pick(SECRET_CATEGORIES);
    const order = ctx.rng.shuffle(ctx.ids);
    const color: Record<string, number> = {};
    order.forEach((id, i) => (color[id] = COLORS[i % COLORS.length]));
    return { cat, word: ctx.rng.pick(cat.words), fake: ctx.rng.pick(ctx.ids), order, turn: -1, phase: 'draw', deadline: 0, canvas: new CanvasStore(), strokeKey: null, votes: {}, caught: false, fakeGuess: null, fakeRight: false, scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])), timer: null, botSeq: 1, color };
  },
  start(s, ctx) {
    nextTurn(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const current = s.order[s.turn % s.order.length];
    if (s.phase === 'draw' && pid === current) {
      if (a.t === 'draw' && a.cv === CV) {
        const key = `${pid}:${a.s}`;
        if (s.strokeKey && s.strokeKey !== key) return; // one stroke per turn
        // force the player's own colour so everyone can tell strokes apart
        const r = s.canvas.apply(pid, { ...a, c: s.color[pid], w: 10 });
        if (r) {
          s.strokeKey = key;
          ctx.markActed(pid);
          relay(ctx, r, ctx.ids.filter((id) => id !== pid));
        }
      } else if (a.t === 'done' && s.strokeKey) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(250, () => nextTurn(s, ctx));
      }
      return;
    }
    if (s.phase === 'vote' && a.t === 'vote' && !s.votes[pid]) {
      if (typeof a.target !== 'string' || !ctx.isPlayer(a.target) || a.target === pid) return;
      ctx.markActed(pid);
      s.votes[pid] = a.target;
      if (allDone(ctx, (id) => !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => tallyVotes(s, ctx));
      }
      return;
    }
    if (s.phase === 'guess' && a.t === 'guess' && pid === s.fake && s.fakeGuess == null) {
      const g = str(a.g, 30);
      if (!g) return;
      ctx.markActed(pid);
      s.fakeGuess = g;
      s.fakeRight = matchAnswer(g, [s.word]) === 'exact';
      ctx.cancel(s.timer);
      s.timer = ctx.after(200, () => reveal(s, ctx));
    }
  },
  pub(s) {
    return {
      category: s.cat.name,
      order: s.order,
      turn: s.turn,
      total: s.order.length * LAPS,
      current: s.phase === 'draw' ? s.order[s.turn % s.order.length] : null,
      phase: s.phase,
      deadline: s.deadline,
      colors: s.color,
      voted: Object.keys(s.votes),
      caughtFake: s.phase === 'guess' || s.phase === 'reveal' ? (s.caught ? s.fake : null) : null,
      reveal: s.phase === 'reveal' ? { fake: s.fake, word: s.word, votes: s.votes, caught: s.caught, guess: s.fakeGuess, right: s.fakeRight } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { isFake: pid === s.fake, word: pid === s.fake ? null : s.word, myVote: s.votes[pid] ?? null };
  },
  rejoin(s, ctx, pid) {
    s.canvas.sync(ctx, CV, pid);
  },
  bot(s, ctx, pid) {
    const current = s.order[s.turn % s.order.length];
    if (s.phase === 'draw' && pid === current) {
      if (!s.strokeKey) return { action: { ...botScribble(CV, s.botSeq++, Math.random), c: s.color[pid] } };
      return { action: { t: 'done' } };
    }
    if (s.phase === 'vote' && !s.votes[pid]) return { action: { t: 'vote', target: ctx.rng.pick(ctx.ids.filter((id) => id !== pid)) } };
    if (s.phase === 'guess' && pid === s.fake) return { action: { t: 'guess', g: ctx.rng.chance(0.3) ? s.word : ctx.rng.pick(s.cat.words) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.scores[id] / 300), participated: ctx.acted(id), highlight: id === s.fake ? `🎭 The Fake Artist — ${!s.caught ? 'escaped!' : s.fakeRight ? 'caught, but guessed the word!' : 'caught!'}` : `Knew the word “${s.word}”` };
    return { perfs, summary: [`🕵️ The Fake Artist was ${ctx.name(s.fake)}; the word was “${s.word}”`] };
  },
});

function nextTurn(s: S, ctx: GameCtx) {
  s.turn++;
  s.strokeKey = null;
  if (s.turn >= s.order.length * LAPS) {
    s.phase = 'vote';
    s.deadline = ctx.now() + ctx.ms(VOTE_MS);
    s.timer = ctx.after(ctx.ms(VOTE_MS), () => tallyVotes(s, ctx));
    ctx.dirty();
    return;
  }
  const current = s.order[s.turn % s.order.length];
  // disconnected players are skipped
  if (!ctx.isConnected(current)) return nextTurn(s, ctx);
  s.phase = 'draw';
  s.deadline = ctx.now() + ctx.ms(TURN_MS);
  s.timer = ctx.after(ctx.ms(TURN_MS), () => nextTurn(s, ctx));
  ctx.dirty();
}

function tallyVotes(s: S, ctx: GameCtx) {
  const counts = tally(s.votes);
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  s.caught = max > 0 && top.length === 1 && top[0] === s.fake;
  for (const [voter, t] of Object.entries(s.votes)) if (t === s.fake && voter !== s.fake) s.scores[voter] += 60;
  if (s.caught) {
    s.phase = 'guess';
    s.deadline = ctx.now() + ctx.ms(GUESS_MS);
    s.timer = ctx.after(ctx.ms(GUESS_MS), () => reveal(s, ctx));
    ctx.dirty();
  } else reveal(s, ctx);
}

function reveal(s: S, ctx: GameCtx) {
  if (!s.caught) s.scores[s.fake] += 320;
  else if (s.fakeRight) s.scores[s.fake] += 220;
  else for (const id of ctx.ids) if (id !== s.fake) s.scores[id] += 140;
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(7000, () => ctx.end());
}
