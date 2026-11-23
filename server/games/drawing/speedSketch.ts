import { defineGame, type GameCtx } from '../../engine/types';
import { CanvasStore, botScribble } from '../../engine/drawing';
import { allDone, isObj } from '../../engine/util';
import { SKETCH_PROMPTS } from '../../content/drawing';

const ROUNDS = 2;
const DRAW_MS = 32_000;
const VOTE_MS = 22_000;

interface S {
  round: number;
  prompts: string[];
  phase: 'draw' | 'vote' | 'reveal';
  deadline: number;
  canvas: CanvasStore;
  votes: Record<string, string>;
  scores: Record<string, number>;
  received: Record<string, number>;
  wins: Record<string, number>;
  done: Record<string, boolean>;
  timer: number | null;
  botSeq: number;
}

const cv = (pid: string, r: number) => `ss:${pid}:${r}`;

export const speedSketch = defineGame<S>({
  id: 'speed-sketch',
  botDelay: [700, 1500],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { round: -1, prompts: ctx.rng.sample(SKETCH_PROMPTS, ROUNDS), phase: 'draw', deadline: 0, canvas: new CanvasStore(), votes: {}, scores: z(), received: z(), wins: z(), done: {}, timer: null, botSeq: 1 };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if ((a.t === 'draw' || a.t === 'undo' || a.t === 'clear') && s.phase === 'draw' && a.cv === cv(pid, s.round)) {
      if (s.canvas.apply(pid, a)) ctx.markActed(pid);
    } else if (a.t === 'done' && s.phase === 'draw') {
      s.done[pid] = true;
      if (allDone(ctx, (id) => !!s.done[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => voting(s, ctx));
      }
    } else if (a.t === 'vote' && s.phase === 'vote' && !s.votes[pid]) {
      if (typeof a.target !== 'string' || !ctx.isPlayer(a.target) || a.target === pid) return;
      ctx.markActed(pid);
      s.votes[pid] = a.target;
      if (allDone(ctx, (id) => !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s) {
    return { round: s.round, n: ROUNDS, prompt: s.prompts[s.round], phase: s.phase, deadline: s.deadline, finished: Object.keys(s.done), voted: Object.keys(s.votes), reveal: s.phase === 'reveal' ? s.votes : null, scores: s.scores };
  },
  priv(s, _ctx, pid) {
    return { myVote: s.votes[pid] ?? null, cv: cv(pid, s.round) };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'draw') return Math.random() < 0.5 ? { action: botScribble(cv(pid, s.round), s.botSeq++, Math.random) } : null;
    if (s.phase === 'vote' && !s.votes[pid]) return { action: { t: 'vote', target: ctx.rng.pick(ctx.ids.filter((id) => id !== pid)) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.received[id] / Math.max(1, (ctx.ids.length - 1) * 0.6)), participated: ctx.acted(id), bonuses: s.wins[id] ? [{ label: `Gallery favourite ×${s.wins[id]}`, pts: 30 * s.wins[id] }] : [], highlight: `${s.received[id]} votes received` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS) return ctx.end();
  s.phase = 'draw';
  s.votes = {};
  s.done = {};
  s.deadline = ctx.now() + ctx.ms(DRAW_MS);
  s.timer = ctx.after(ctx.ms(DRAW_MS), () => voting(s, ctx));
  ctx.dirty();
}

function voting(s: S, ctx: GameCtx) {
  const gallery: Record<string, unknown> = {};
  for (const id of ctx.ids) gallery[id] = s.canvas.snapshot(cv(id, s.round));
  ctx.asset(`ss:gallery:${s.round}`, gallery);
  s.phase = 'vote';
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const counts: Record<string, number> = {};
  for (const t of Object.values(s.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  for (const [id, n] of Object.entries(counts)) {
    s.scores[id] += n * 100;
    s.received[id] += n;
    if (n === max && max > 0) {
      s.scores[id] += 50;
      s.wins[id]++;
    }
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(5000, () => next(s, ctx));
}
