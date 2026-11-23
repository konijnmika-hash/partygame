import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int } from '../../engine/util';
import { PREDICT_QUESTIONS } from '../../content/social';

const QUESTIONS = 6;
const ANSWER_MS = 12_000;
const PREDICT_MS = 14_000;

interface S {
  i: number;
  qs: string[];
  phase: 'answer' | 'predict' | 'reveal';
  answers: Record<string, boolean>;
  preds: Record<string, number>;
  yes: number;
  deadline: number;
  scores: Record<string, number>;
  exact: Record<string, number>;
  timer: number | null;
}

export const groupPrediction = defineGame<S>({
  id: 'group-prediction',
  botDelay: [1200, 3500],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, qs: ctx.rng.sample(PREDICT_QUESTIONS, QUESTIONS), phase: 'answer', answers: {}, preds: {}, yes: 0, deadline: 0, scores: z(), exact: z(), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'answer' && s.phase === 'answer' && s.answers[pid] == null && typeof a.v === 'boolean') {
      ctx.markActed(pid);
      s.answers[pid] = a.v;
      if (allDone(ctx, (id) => s.answers[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(250, () => predict(s, ctx));
      }
    } else if (a.t === 'predict' && s.phase === 'predict' && s.preds[pid] == null) {
      const v = int(a.v, 0, ctx.ids.length);
      if (v == null) return;
      ctx.markActed(pid);
      s.preds[pid] = v;
      if (allDone(ctx, (id) => s.preds[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(250, () => reveal(s, ctx));
      }
    }
  },
  pub(s, ctx) {
    return { i: s.i, n: QUESTIONS, q: s.qs[s.i], phase: s.phase, deadline: s.deadline, players: ctx.ids.length, answered: Object.keys(s.answers), predicted: Object.keys(s.preds), reveal: s.phase === 'reveal' ? { yes: s.yes, preds: s.preds } : null, scores: s.scores };
  },
  priv(s, _ctx, pid) {
    return { answer: s.answers[pid] ?? null, pred: s.preds[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'answer' && s.answers[pid] == null) return { action: { t: 'answer', v: ctx.rng.chance(0.5) } };
    if (s.phase === 'predict' && s.preds[pid] == null) return { action: { t: 'predict', v: Math.max(0, Math.min(ctx.ids.length, Math.round(ctx.ids.length / 2 + (Math.random() - 0.5) * 3))) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.scores[id] / (QUESTIONS * 110)), participated: ctx.acted(id), bonuses: s.exact[id] >= 3 ? [{ label: 'Mind reader', pts: 40 }] : [], highlight: `${s.exact[id]} exact predictions` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= QUESTIONS) return ctx.end();
  s.phase = 'answer';
  s.answers = {};
  s.preds = {};
  s.deadline = ctx.now() + ctx.ms(ANSWER_MS);
  s.timer = ctx.after(ctx.ms(ANSWER_MS), () => predict(s, ctx));
  ctx.dirty();
}

function predict(s: S, ctx: GameCtx) {
  s.phase = 'predict';
  s.deadline = ctx.now() + ctx.ms(PREDICT_MS);
  s.timer = ctx.after(ctx.ms(PREDICT_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  s.yes = Object.values(s.answers).filter(Boolean).length;
  for (const [pid, p] of Object.entries(s.preds)) {
    const off = Math.abs(p - s.yes);
    const pts = off === 0 ? 150 : off === 1 ? 80 : off === 2 ? 30 : 0;
    s.scores[pid] += pts;
    if (off === 0) s.exact[pid]++;
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(4200, () => next(s, ctx));
}
