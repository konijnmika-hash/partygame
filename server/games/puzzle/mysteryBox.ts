import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int } from '../../engine/util';
import { MYSTERY_ITEMS } from '../../content/puzzles';

const BOXES = 6;
const CLUE_MS = 3600;

interface S {
  i: number;
  items: typeof MYSTERY_ITEMS;
  choices: number[]; // indices into MYSTERY_ITEMS
  answer: number; // index into choices
  clues: number;
  phase: 'play' | 'reveal';
  picks: Record<string, { c: number; clues: number; ok: boolean; pts: number }>;
  scores: Record<string, number>;
  right: Record<string, number>;
  timers: number[];
  botAt: Record<string, number>;
}

export const mysteryBox = defineGame<S>({
  id: 'mystery-box',
  botDelay: [500, 1200],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, items: MYSTERY_ITEMS, choices: [], answer: 0, clues: 0, phase: 'play', picks: {}, scores: z(), right: z(), timers: [], botAt: {} };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'guess' || s.phase !== 'play' || s.picks[pid]) return;
    const c = int(a.c, 0, s.choices.length - 1);
    if (c == null) return;
    ctx.markActed(pid);
    const ok = c === s.answer;
    const pts = ok ? 30 + (6 - s.clues) * 28 : 0;
    s.picks[pid] = { c, clues: s.clues, ok, pts };
    if (ok) {
      s.scores[pid] += pts;
      s.right[pid]++;
    }
    if (allDone(ctx, (id) => !!s.picks[id])) {
      for (const t of s.timers) ctx.cancel(t);
      s.timers = [ctx.after(500, () => reveal(s, ctx))];
    }
  },
  pub(s) {
    const item = s.items[s.choices[s.answer]];
    return {
      i: s.i,
      n: BOXES,
      phase: s.phase,
      clues: item ? item.clues.slice(0, s.clues) : [],
      totalClues: 6,
      choices: s.choices.map((k) => ({ name: s.items[k].name, emoji: s.items[k].emoji })),
      guessed: Object.keys(s.picks),
      reveal: s.phase === 'reveal' ? { answer: s.answer, picks: s.picks } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.picks[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'play' || s.picks[pid]) return null;
    const at = (s.botAt[pid] ??= ctx.rng.int(ctx.diff(4, 3, 2), 6));
    if (s.clues < at) return null;
    const ok = Math.random() < ctx.diff(0.6, 0.75, 0.9);
    return { action: { t: 'guess', c: ok ? s.answer : ctx.rng.int(0, s.choices.length - 1) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.scores[id] / (BOXES * 140), participated: ctx.acted(id), highlight: `${s.right[id]}/${BOXES} boxes cracked` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= BOXES) return ctx.end();
  const answerItem = ctx.rng.int(0, s.items.length - 1);
  const others = ctx.rng.sample(s.items.map((_, k) => k).filter((k) => k !== answerItem), 7);
  s.choices = ctx.rng.shuffle([answerItem, ...others]);
  s.answer = s.choices.indexOf(answerItem);
  s.clues = 1;
  s.picks = {};
  s.botAt = {};
  s.phase = 'play';
  s.timers = [];
  for (let k = 2; k <= 6; k++) s.timers.push(ctx.after(ctx.ms(CLUE_MS * (k - 1)), () => { s.clues = k; ctx.dirty(); }));
  s.timers.push(ctx.after(ctx.ms(CLUE_MS * 6 + 3000), () => reveal(s, ctx)));
}

function reveal(s: S, ctx: GameCtx) {
  s.phase = 'reveal';
  ctx.dirty();
  s.timers = [ctx.after(2600, () => next(s, ctx))];
}
