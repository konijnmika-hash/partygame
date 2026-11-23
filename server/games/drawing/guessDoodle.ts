// Guess the Doodle: the server streams an original doodle stroke-by-stroke; first correct guesses win.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int } from '../../engine/util';
import { DOODLES, resample } from '@shared/doodles';

const ROUNDS = 6;
const DRAW_MS = 11_000;
const EXTRA_MS = 3500;
const CHUNK_MS = 220;

interface S {
  round: number;
  order: number[];
  choices: string[];
  points: number[][]; // per stroke resampled points
  revealed: number; // number of points revealed so far (across strokes)
  total: number;
  startedAt: number;
  deadline: number;
  phase: 'draw' | 'reveal';
  correct: Record<string, number>; // elapsed ms when solved
  lock: Record<string, number>;
  scores: Record<string, number>;
  solved: Record<string, number>;
  timer: number | null;
  chunker: number | null;
}

/** Points revealed so far as polylines (stroke-by-stroke). */
function visible(s: S): number[][] {
  const out: number[][] = [];
  let left = s.revealed;
  for (const st of s.points) {
    if (left <= 0) break;
    const n = Math.min(st.length / 2, left);
    out.push(st.slice(0, n * 2));
    left -= n;
  }
  return out;
}

export const guessDoodle = defineGame<S>({
  id: 'guess-doodle',
  botDelay: [500, 1100],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { round: -1, order: ctx.rng.sample(DOODLES.map((_, i) => i), ROUNDS), choices: [], points: [], revealed: 0, total: 0, startedAt: 0, deadline: 0, phase: 'draw', correct: {}, lock: {}, scores: z(), solved: z(), timer: null, chunker: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'pick' || s.phase !== 'draw' || s.correct[pid] != null) return;
    if ((s.lock[pid] ?? 0) > ctx.now()) return;
    const c = int(a.c, 0, s.choices.length - 1);
    if (c == null) return;
    ctx.markActed(pid);
    if (s.choices[c] === DOODLES[s.order[s.round]].name) {
      const el = Math.max(0, ctx.now() - s.startedAt - ctx.rtt(pid) / 2);
      s.correct[pid] = el;
      const order = Object.keys(s.correct).length - 1;
      const pts = Math.round(40 + 110 * Math.max(0, 1 - el / (DRAW_MS + EXTRA_MS))) + Math.max(0, 20 - order * 5);
      s.scores[pid] += pts;
      s.solved[pid]++;
      ctx.event('correct', { pts }, pid);
      if (allDone(ctx, (id) => s.correct[id] != null)) {
        ctx.cancel(s.timer);
        ctx.cancel(s.chunker);
        s.timer = ctx.after(500, () => reveal(s, ctx));
      }
    } else {
      s.lock[pid] = ctx.now() + 2000;
      ctx.event('wrong', { c }, pid);
    }
  },
  pub(s) {
    return { round: s.round, n: ROUNDS, choices: s.choices, phase: s.phase, deadline: s.deadline, startedAt: s.startedAt, solvedBy: Object.keys(s.correct), answer: s.phase === 'reveal' ? DOODLES[s.order[s.round]].name : null, scores: s.scores, revealed: s.revealed };
  },
  priv(s, _ctx, pid) {
    return { lockUntil: s.lock[pid] ?? 0, solved: s.correct[pid] != null };
  },
  rejoin(s, ctx, pid) {
    ctx.event('gd-full', { round: s.round, strokes: visible(s) }, pid);
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'draw' || s.correct[pid] != null || (s.lock[pid] ?? 0) > ctx.now()) return null;
    const frac = s.revealed / Math.max(1, s.total);
    if (Math.random() > frac * ctx.diff(0.5, 0.7, 0.9)) return null;
    const ans = s.choices.indexOf(DOODLES[s.order[s.round]].name);
    return { action: { t: 'pick', c: Math.random() < 0.75 ? ans : ctx.rng.int(0, s.choices.length - 1) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.scores[id] / (ROUNDS * 140), participated: ctx.acted(id), highlight: `${s.solved[id]}/${ROUNDS} doodles guessed` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS) return ctx.end();
  const d = DOODLES[s.order[s.round]];
  s.points = d.strokes.map((st) => resample([st], 26).map((v) => Math.round(v)));
  s.total = s.points.reduce((n, p) => n + p.length / 2, 0);
  s.revealed = 0;
  const others = ctx.rng.sample(DOODLES.filter((x) => x.name !== d.name).map((x) => x.name), 7);
  s.choices = ctx.rng.shuffle([d.name, ...others]);
  s.correct = {};
  s.lock = {};
  s.phase = 'draw';
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + DRAW_MS + EXTRA_MS;
  const perChunk = Math.max(1, Math.ceil(s.total / (DRAW_MS / CHUNK_MS)));
  const tick = () => {
    if (s.phase !== 'draw' || s.revealed >= s.total) return;
    const before = visible(s).map((p) => p.length);
    s.revealed = Math.min(s.total, s.revealed + perChunk);
    // send only the newly visible part of each stroke
    const now = visible(s);
    const delta = now.map((p, i) => ({ i, p: p.slice(Math.max(0, (before[i] ?? 0) - 2)) })).filter((d2) => d2.p.length >= 4 || (before[d2.i] == null && d2.p.length >= 2));
    if (delta.length) ctx.event('gd', { round: s.round, delta });
    s.chunker = ctx.after(CHUNK_MS, tick);
  };
  s.chunker = ctx.after(400, tick);
  s.timer = ctx.after(DRAW_MS + EXTRA_MS, () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  ctx.cancel(s.chunker);
  s.phase = 'reveal';
  s.revealed = s.total;
  ctx.event('gd-full', { round: s.round, strokes: visible(s) });
  ctx.dirty();
  s.timer = ctx.after(2600, () => next(s, ctx));
}
