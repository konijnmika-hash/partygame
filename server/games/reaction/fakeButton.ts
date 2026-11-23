import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, reactionTime } from '../../engine/util';

// The real button is ROUND + GREEN + says "GO!". Decoys change exactly one thing.
const REAL = { label: 'GO!', color: '#34cf78', shape: 'round' };
const DECOYS = [
  { label: 'NO!', color: '#34cf78', shape: 'round' },
  { label: 'GO!', color: '#ff4f5f', shape: 'round' },
  { label: 'G0!', color: '#34cf78', shape: 'round' },
  { label: 'OG!', color: '#34cf78', shape: 'round' },
  { label: 'GO!', color: '#34cf78', shape: 'square' },
  { label: 'GO?', color: '#34cf78', shape: 'round' },
  { label: 'GO!', color: '#3da9fc', shape: 'round' },
  { label: 'STOP', color: '#ff4f5f', shape: 'round' },
  { label: 'WAIT', color: '#34cf78', shape: 'round' },
  { label: 'GO!', color: '#ffd23f', shape: 'star' },
  { label: 'G O', color: '#34cf78', shape: 'round' },
  { label: 'GOO', color: '#34cf78', shape: 'round' },
];

const FLASHES = 15;

interface Flash {
  label: string;
  color: string;
  shape: string;
  real: boolean;
}

interface S {
  i: number;
  phase: 'blank' | 'show' | 'done';
  flash: Flash | null;
  shownAt: number;
  windowMs: number;
  taps: Record<string, number>; // points gained on current flash
  scores: Record<string, number>;
  correct: Record<string, number>;
  mistakes: Record<string, number>;
  reals: number;
  decoys: number;
  timer: number | null;
  botPlan: Record<string, number>;
}

export const fakeButton = defineGame<S>({
  id: 'fake-button',
  botDelay: [60, 120],
  setup(ctx) {
    const z = Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, phase: 'blank', flash: null, shownAt: 0, windowMs: ctx.ms(ctx.diff(1300, 1050, 850)), taps: {}, scores: { ...z }, correct: { ...z }, mistakes: { ...z }, reals: 0, decoys: 0, timer: null, botPlan: {} };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap' || s.taps[pid] !== undefined) return;
    ctx.markActed(pid);
    if (s.phase !== 'show' || !s.flash) {
      // spamming during blanks costs a little
      s.scores[pid] -= 10;
      s.taps[pid] = -10;
      return;
    }
    if (s.flash.real) {
      const ms = reactionTime(ctx, pid, s.shownAt, a.ms);
      const pts = Math.round(Math.max(35, 100 - Math.max(0, ms - 250) * (65 / Math.max(1, s.windowMs - 250))));
      s.taps[pid] = pts;
      s.scores[pid] += pts;
      s.correct[pid]++;
    } else {
      s.taps[pid] = -60;
      s.scores[pid] -= 60;
      s.mistakes[pid]++;
      ctx.event('fooled', null, pid);
    }
  },
  pub(s) {
    return { i: s.i, n: FLASHES, phase: s.phase, flash: s.phase === 'show' ? { label: s.flash!.label, color: s.flash!.color, shape: s.flash!.shape } : null, shownAt: s.shownAt, taps: s.taps, scores: s.scores };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'show' || !s.flash || s.taps[pid] !== undefined) return null;
    const plan = (s.botPlan[pid] ??= s.flash.real ? (Math.random() < ctx.diff(0.8, 0.88, 0.95) ? 280 + Math.random() * 380 : -1) : Math.random() < ctx.diff(0.25, 0.14, 0.07) ? 300 + Math.random() * 300 : -1);
    if (plan < 0) return null;
    const el = ctx.now() - s.shownAt;
    return el >= plan ? { action: { t: 'tap', ms: el } } : null;
  },
  results(s, ctx) {
    const max = s.reals * 90 + s.decoys * 10;
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const bonuses = s.mistakes[id] === 0 && s.correct[id] >= s.reals - 1 ? [{ label: 'Never fooled', pts: 40 }] : [];
      perfs[id] = { score: s.scores[id], perf: Math.max(0, s.scores[id]) / Math.max(1, max), participated: ctx.acted(id), bonuses, highlight: `${s.correct[id]}/${s.reals} real · fooled ${s.mistakes[id]}×` };
    }
    const fooled = ctx.ids.reduce((best, id) => (s.mistakes[id] > (s.mistakes[best] ?? -1) ? id : best), ctx.ids[0]);
    return { perfs, summary: s.mistakes[fooled] > 0 ? [`🤡 Most fooled: ${ctx.name(fooled)} (${s.mistakes[fooled]} decoys)`] : ['🧠 Nobody fell for a decoy!'] };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= FLASHES) {
    s.phase = 'done';
    ctx.end();
    return;
  }
  s.phase = 'blank';
  s.flash = null;
  s.taps = {};
  s.botPlan = {};
  const gap = 500 + ctx.rng.next() * 900;
  s.timer = ctx.after(gap, () => {
    // guarantee a healthy number of real buttons
    const realsLeft = Math.max(0, 6 - s.reals);
    const flashesLeft = FLASHES - s.i;
    const real = realsLeft >= flashesLeft || ctx.rng.chance(0.42);
    s.flash = real ? { ...REAL, real: true } : { ...ctx.rng.pick(DECOYS), real: false };
    if (real) s.reals++;
    else s.decoys++;
    s.phase = 'show';
    s.shownAt = ctx.now();
    ctx.dirty();
    s.timer = ctx.after(s.windowMs, () => {
      if (s.flash && !s.flash.real) {
        for (const id of ctx.ids) if (s.taps[id] === undefined) s.scores[id] += 10; // restraint pays
      }
      next(s, ctx);
    });
  });
}
