// Pixel Art Guess: everyone paints their secret word on a tiny grid, then guesses each painting.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int } from '../../engine/util';
import { DRAW_WORDS_EASY } from '../../content/drawing';

export const PX = 10;
export const PX_COLORS = 7; // 0 = empty
const PAINT_MS = 45_000;
const GUESS_MS = 13_000;
const MAX_SHOWN = 6;

interface S {
  words: Record<string, string>;
  grids: Record<string, number[]>;
  phase: 'paint' | 'guess' | 'reveal';
  deadline: number;
  queue: string[];
  qi: number;
  options: string[];
  shownAt: number;
  picks: Record<string, { c: number; ms: number }>;
  done: Record<string, boolean>;
  scores: Record<string, number>;
  right: Record<string, number>;
  recognized: Record<string, number>;
  timer: number | null;
}

export const pixelGuess = defineGame<S>({
  id: 'pixel-guess',
  botDelay: [250, 600],
  setup(ctx) {
    const words = ctx.rng.sample(DRAW_WORDS_EASY.filter((w) => !w.includes(' ')), ctx.ids.length);
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { words: Object.fromEntries(ctx.ids.map((id, i) => [id, words[i]])), grids: Object.fromEntries(ctx.ids.map((id) => [id, new Array(PX * PX).fill(0)])), phase: 'paint', deadline: 0, queue: [], qi: -1, options: [], shownAt: 0, picks: {}, done: {}, scores: z(), right: z(), recognized: z(), timer: null };
  },
  start(s, ctx) {
    s.deadline = ctx.now() + ctx.ms(PAINT_MS);
    s.timer = ctx.after(ctx.ms(PAINT_MS), () => beginGuess(s, ctx));
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (s.phase === 'paint') {
      if (a.t === 'px') {
        const i = int(a.i, 0, PX * PX - 1);
        const c = int(a.c, 0, PX_COLORS - 1);
        if (i == null || c == null) return;
        s.grids[pid][i] = c;
        ctx.markActed(pid);
      } else if (a.t === 'done') {
        s.done[pid] = true;
        if (allDone(ctx, (id) => !!s.done[id])) {
          ctx.cancel(s.timer);
          s.timer = ctx.after(300, () => beginGuess(s, ctx));
        }
      }
      return;
    }
    if (s.phase === 'guess' && a.t === 'pick' && !s.picks[pid] && s.queue[s.qi] !== pid) {
      const c = int(a.c, 0, s.options.length - 1);
      if (c == null) return;
      ctx.markActed(pid);
      s.picks[pid] = { c, ms: ctx.now() - s.shownAt };
      if (allDone(ctx, (id) => id === s.queue[s.qi] || !!s.picks[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s) {
    const artist = s.queue[s.qi];
    return {
      phase: s.phase,
      deadline: s.deadline,
      size: PX,
      painted: Object.keys(s.done),
      artist: s.phase === 'paint' ? null : artist,
      qi: s.qi,
      qn: s.queue.length,
      grid: s.phase === 'paint' ? null : s.grids[artist],
      options: s.phase === 'paint' ? null : s.options,
      picked: Object.keys(s.picks),
      reveal: s.phase === 'reveal' ? { answer: s.options.indexOf(s.words[artist]), picks: Object.fromEntries(Object.entries(s.picks).map(([id, p]) => [id, p.c])) } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { word: s.words[pid], grid: s.phase === 'paint' ? s.grids[pid] : null, myPick: s.picks[pid]?.c ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'paint') {
      if (s.done[pid]) return null;
      if (Math.random() < 0.08) return { action: { t: 'done' } };
      // paint a blobby shape around the centre
      const r = ctx.rng.int(2, 7), c = ctx.rng.int(2, 7);
      return { action: { t: 'px', i: r * PX + c, c: ctx.rng.int(1, PX_COLORS - 1) } };
    }
    if (s.phase === 'guess' && s.queue[s.qi] !== pid && !s.picks[pid]) {
      const ans = s.options.indexOf(s.words[s.queue[s.qi]]);
      return { action: { t: 'pick', c: Math.random() < ctx.diff(0.35, 0.5, 0.65) ? ans : ctx.rng.int(0, s.options.length - 1) } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const rounds = Math.max(1, s.queue.length - 1);
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.right[id] / rounds) * 0.65 + Math.min(1, s.recognized[id] / Math.max(1, ctx.ids.length - 1)) * 0.35, participated: ctx.acted(id), highlight: `Guessed ${s.right[id]} · art recognised by ${s.recognized[id]}` };
    return { perfs };
  },
});

function beginGuess(s: S, ctx: GameCtx) {
  s.queue = ctx.rng.shuffle(ctx.ids.filter((id) => s.grids[id].some((v) => v > 0))).slice(0, MAX_SHOWN);
  if (!s.queue.length) return ctx.end();
  s.qi = -1;
  nextPainting(s, ctx);
}

function nextPainting(s: S, ctx: GameCtx) {
  s.qi++;
  if (s.qi >= s.queue.length) return ctx.end();
  const artist = s.queue[s.qi];
  const others = Object.values(s.words).filter((w) => w !== s.words[artist]);
  const decoys = ctx.rng.sample([...new Set([...others, ...ctx.rng.sample(DRAW_WORDS_EASY, 8)])].filter((w) => w !== s.words[artist]), 5);
  s.options = ctx.rng.shuffle([s.words[artist], ...decoys]);
  s.picks = {};
  s.phase = 'guess';
  s.shownAt = ctx.now();
  s.deadline = s.shownAt + ctx.ms(GUESS_MS);
  s.timer = ctx.after(ctx.ms(GUESS_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const artist = s.queue[s.qi];
  const ans = s.options.indexOf(s.words[artist]);
  for (const [pid, p] of Object.entries(s.picks)) {
    if (p.c === ans) {
      s.scores[pid] += 70 + Math.round(40 * Math.max(0, 1 - p.ms / ctx.ms(GUESS_MS)));
      s.right[pid]++;
      s.scores[artist] += 45;
      s.recognized[artist]++;
    }
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(3200, () => nextPainting(s, ctx));
}
