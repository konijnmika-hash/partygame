// Drawing Relay: write -> draw -> describe -> draw, passed around the room, then the big reveal.
import { defineGame, type GameCtx } from '../../engine/types';
import { CanvasStore, botScribble } from '../../engine/drawing';
import { allDone, isObj, str } from '../../engine/util';
import { BOT_ANSWERS } from '../../content/social';
import { SKETCH_PROMPTS } from '../../content/drawing';

const STEP_MS = { text0: 30_000, draw: 45_000, text: 28_000 };
const VOTE_MS = 35_000;

interface Step {
  kind: 'text' | 'draw';
  by: string;
  text?: string;
  strokes?: { c: number; w: number; p: number[] }[];
}
interface S {
  n: number;
  steps: number;
  k: number;
  chains: Step[][];
  phase: 'step' | 'vote' | 'reveal';
  deadline: number;
  submitted: Record<string, boolean>;
  canvas: CanvasStore;
  votes: Record<string, number>;
  scores: Record<string, number>;
  timer: number | null;
  botSeq: number;
}

const kindOf = (k: number): 'text' | 'draw' => (k % 2 === 0 ? 'text' : 'draw');

export const drawingRelay = defineGame<S>({
  id: 'drawing-relay',
  botDelay: [900, 2200],
  setup(ctx) {
    const n = ctx.ids.length;
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { n, steps: Math.min(4, n), k: -1, chains: ctx.ids.map(() => []), phase: 'step', deadline: 0, submitted: {}, canvas: new CanvasStore(), votes: {}, scores: z(), timer: null, botSeq: 1 };
  },
  start(s, ctx) {
    nextStep(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const pi = ctx.ids.indexOf(pid);
    const chain = (pi + Math.max(0, s.k)) % s.n;
    if (s.phase === 'step') {
      const kind = kindOf(s.k);
      if (kind === 'text' && a.t === 'text' && !s.submitted[pid]) {
        const v = str(a.v, 80, 2);
        if (!v) return;
        ctx.markActed(pid);
        s.chains[chain][s.k] = { kind: 'text', by: pid, text: v };
        submit(s, ctx, pid);
      } else if (kind === 'draw' && (a.t === 'draw' || a.t === 'undo' || a.t === 'clear') && a.cv === `dr:${chain}:${s.k}` && !s.submitted[pid]) {
        if (s.canvas.apply(pid, a)) ctx.markActed(pid);
      } else if (kind === 'draw' && a.t === 'done' && !s.submitted[pid]) {
        submit(s, ctx, pid);
      }
    } else if (s.phase === 'vote' && a.t === 'vote' && s.votes[pid] == null) {
      const c = typeof a.c === 'number' && Number.isInteger(a.c) && a.c >= 0 && a.c < s.n ? a.c : null;
      if (c == null || c === pi) return; // can't vote for the chain you started
      ctx.markActed(pid);
      s.votes[pid] = c;
      if (allDone(ctx, (id) => s.votes[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s, ctx) {
    return { k: s.k, steps: s.steps, kind: s.phase === 'step' ? kindOf(s.k) : null, phase: s.phase, deadline: s.deadline, submitted: Object.keys(s.submitted), voted: Object.keys(s.votes), reveal: s.phase === 'reveal' ? s.votes : null, scores: s.scores, starters: ctx.ids };
  },
  priv(s, ctx, pid) {
    if (s.phase !== 'step') return { myChain: ctx.ids.indexOf(pid) };
    const pi = ctx.ids.indexOf(pid);
    const chain = (pi + s.k) % s.n;
    const prev = s.k > 0 ? s.chains[chain][s.k - 1] : null;
    return { myChain: pi, chain, cv: `dr:${chain}:${s.k}`, submitted: !!s.submitted[pid], prevText: prev?.kind === 'text' ? prev.text : null, prevKey: prev?.kind === 'draw' ? `dr:prev:${chain}:${s.k - 1}` : null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'step' && !s.submitted[pid]) {
      const kind = kindOf(s.k);
      const chain = (ctx.ids.indexOf(pid) + s.k) % s.n;
      if (kind === 'text') return { action: { t: 'text', v: s.k === 0 ? ctx.rng.pick(SKETCH_PROMPTS) : ctx.rng.pick(BOT_ANSWERS) } };
      return Math.random() < 0.6 ? { action: botScribble(`dr:${chain}:${s.k}`, s.botSeq++, Math.random) } : { action: { t: 'done' } };
    }
    if (s.phase === 'vote' && s.votes[pid] == null) {
      const pi = ctx.ids.indexOf(pid);
      const opts = s.chains.map((_, i) => i).filter((i) => i !== pi);
      return { action: { t: 'vote', c: ctx.rng.pick(opts) } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.scores[id] / (s.steps * 30 + 150)), participated: ctx.acted(id), highlight: `${s.scores[id]} relay points` };
    return { perfs };
  },
});

function submit(s: S, ctx: GameCtx, pid: string) {
  s.submitted[pid] = true;
  s.scores[pid] += 30;
  if (allDone(ctx, (id) => !!s.submitted[id])) {
    ctx.cancel(s.timer);
    s.timer = ctx.after(300, () => nextStep(s, ctx));
  }
}

function closeStep(s: S, ctx: GameCtx) {
  if (s.k < 0) return;
  const kind = kindOf(s.k);
  ctx.ids.forEach((pid, pi) => {
    const chain = (pi + s.k) % s.n;
    if (kind === 'draw') s.chains[chain][s.k] = { kind: 'draw', by: pid, strokes: s.canvas.snapshot(`dr:${chain}:${s.k}`) };
    else if (!s.chains[chain][s.k]) s.chains[chain][s.k] = { kind: 'text', by: pid, text: s.k === 0 ? 'something mysterious' : '🤷 (no idea!)' };
  });
}

function nextStep(s: S, ctx: GameCtx) {
  closeStep(s, ctx);
  s.k++;
  s.submitted = {};
  if (s.k >= s.steps) {
    ctx.asset('relay:chains', s.chains);
    s.phase = 'vote';
    s.deadline = ctx.now() + ctx.ms(VOTE_MS);
    s.timer = ctx.after(ctx.ms(VOTE_MS), () => reveal(s, ctx));
    ctx.dirty();
    return;
  }
  // give each player the drawing they must describe
  if (kindOf(s.k) === 'text' && s.k > 0) {
    s.chains.forEach((chain, ci) => {
      const prev = chain[s.k - 1];
      if (prev?.kind === 'draw') ctx.asset(`dr:prev:${ci}:${s.k - 1}`, prev.strokes);
    });
  }
  const ms = ctx.ms(s.k === 0 ? STEP_MS.text0 : kindOf(s.k) === 'draw' ? STEP_MS.draw : STEP_MS.text);
  s.phase = 'step';
  s.deadline = ctx.now() + ms;
  s.timer = ctx.after(ms, () => nextStep(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const counts: Record<number, number> = {};
  for (const c of Object.values(s.votes)) counts[c] = (counts[c] ?? 0) + 1;
  for (const [c, n] of Object.entries(counts)) {
    const chain = s.chains[Number(c)];
    const contributors = [...new Set(chain.map((st) => st.by))];
    for (const id of contributors) s.scores[id] += Math.round((n * 100) / contributors.length);
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(6000, () => ctx.end());
}
