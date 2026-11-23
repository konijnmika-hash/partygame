import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, str } from '../../engine/util';
import { COMMON_WORDS } from '../../content/words';

const WORDS = 8;
const WORD_MS = 22_000;

interface S {
  i: number;
  words: string[];
  scrambled: string;
  phase: 'play' | 'reveal';
  startedAt: number;
  deadline: number;
  hints: number;
  solved: Record<string, number>;
  scores: Record<string, number>;
  count: Record<string, number>;
  timers: number[];
  lastGuess: Record<string, number>;
}

function scramble(ctx: GameCtx, w: string): string {
  for (let k = 0; k < 20; k++) {
    const s = ctx.rng.shuffle(w.split('')).join('');
    if (s !== w) return s;
  }
  return w.split('').reverse().join('');
}

export const wordScramble = defineGame<S>({
  id: 'word-scramble',
  botDelay: [900, 2000],
  setup(ctx) {
    const pool = COMMON_WORDS.filter((w) => w.length >= ctx.diff(5, 5, 6) && w.length <= ctx.diff(6, 7, 8));
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, words: ctx.rng.sample(pool, WORDS), scrambled: '', phase: 'play', startedAt: 0, deadline: 0, hints: 0, solved: {}, scores: z(), count: z(), timers: [], lastGuess: {} };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'guess' || s.phase !== 'play' || s.solved[pid] != null) return;
    const g = str(a.w, 20);
    if (!g) return;
    const now = ctx.now();
    if (now - (s.lastGuess[pid] ?? 0) < 250) return;
    s.lastGuess[pid] = now;
    ctx.markActed(pid);
    if (g.toLowerCase().replace(/[^a-z]/g, '') === s.words[s.i]) {
      const order = Object.keys(s.solved).length;
      s.solved[pid] = order;
      const pts = Math.max(40, 110 - order * 12) - s.hints * 15 + Math.round(30 * Math.max(0, 1 - (now - s.startedAt) / WORD_MS));
      s.scores[pid] += Math.max(20, pts);
      s.count[pid]++;
      ctx.event('solved', { pts: Math.max(20, pts) }, pid);
      if (allDone(ctx, (id) => s.solved[id] != null)) {
        for (const t of s.timers) ctx.cancel(t);
        s.timers = [ctx.after(400, () => reveal(s, ctx))];
      }
    } else ctx.event('wrong', null, pid);
  },
  pub(s) {
    const w = s.words[s.i] ?? '';
    const mask = w.split('').map((c, k) => (k < s.hints ? c : '_')).join('');
    return { i: s.i, n: WORDS, scrambled: s.scrambled, len: w.length, mask, phase: s.phase, deadline: s.deadline, solved: s.solved, answer: s.phase === 'reveal' ? w : null, scores: s.scores };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'play' || s.solved[pid] != null) return null;
    const el = ctx.now() - s.startedAt;
    if (el < 3500 || Math.random() > ctx.diff(0.15, 0.22, 0.3)) return null;
    return { action: { t: 'guess', w: Math.random() < 0.8 ? s.words[s.i] : s.scrambled } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.scores[id] / (WORDS * 120), participated: ctx.acted(id), bonuses: s.count[id] === WORDS ? [{ label: 'Solved every word', pts: 40 }] : [], highlight: `${s.count[id]}/${WORDS} words` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= WORDS) return ctx.end();
  s.scrambled = scramble(ctx, s.words[s.i]).toUpperCase();
  s.solved = {};
  s.hints = 0;
  s.phase = 'play';
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + ctx.ms(WORD_MS);
  s.timers = [
    ctx.after(ctx.ms(9000), () => { s.hints = 1; ctx.dirty(); }),
    ctx.after(ctx.ms(15000), () => { s.hints = 2; ctx.dirty(); }),
    ctx.after(ctx.ms(WORD_MS), () => reveal(s, ctx)),
  ];
}

function reveal(s: S, ctx: GameCtx) {
  s.phase = 'reveal';
  ctx.dirty();
  s.timers = [ctx.after(2200, () => next(s, ctx))];
}
