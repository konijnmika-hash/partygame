import { defineGame } from '../../engine/types';
import { isObj, num } from '../../engine/util';
import { createRng } from '@shared/rng';

const DURATION = 45_000;

interface Prob {
  text: string;
  ans: number;
}

/** Deterministic problem #i: every player gets the same sequence, difficulty ramps up. */
export function mathProblem(seed: number, i: number, hard: boolean): Prob {
  const r = createRng(seed + i * 7919);
  const lvl = Math.floor(i / 4) + (hard ? 1 : 0);
  if (lvl === 0) {
    const a = r.int(1, 9), b = r.int(1, 9);
    return { text: `${a} + ${b}`, ans: a + b };
  }
  if (lvl === 1) {
    const a = r.int(5, 20), b = r.int(1, a);
    return { text: `${a} − ${b}`, ans: a - b };
  }
  if (lvl === 2) {
    const a = r.int(2, 9), b = r.int(2, 9);
    return { text: `${a} × ${b}`, ans: a * b };
  }
  const k = r.int(0, 3);
  if (k === 0) {
    const a = r.int(11, 79), b = r.int(11, 49);
    return { text: `${a} + ${b}`, ans: a + b };
  }
  if (k === 1) {
    const a = r.int(30, 99), b = r.int(11, a - 1);
    return { text: `${a} − ${b}`, ans: a - b };
  }
  if (k === 2) {
    const a = r.int(3, 12), b = r.int(3, 12);
    return { text: `${a} × ${b}`, ans: a * b };
  }
  const b = r.int(2, 9), q = r.int(2, 12);
  return { text: `${b * q} ÷ ${b}`, ans: q };
}

interface P {
  idx: number;
  streak: number;
  best: number;
  right: number;
  wrong: number;
  score: number;
}
interface S {
  seed: number;
  endsAt: number;
  p: Record<string, P>;
}

export const quickMath = defineGame<S>({
  id: 'quick-math',
  botDelay: [1300, 3200],
  setup(ctx) {
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { idx: 0, streak: 0, best: 0, right: 0, wrong: 0, score: 0 };
    return { seed: ctx.rng.int(1, 1e9), endsAt: 0, p };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
    ctx.after(ctx.ms(DURATION), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'answer') return;
    const v = num(a.v, -1e6, 1e6);
    if (v == null) return;
    ctx.markActed(pid);
    const pl = s.p[pid];
    const prob = mathProblem(s.seed, pl.idx, ctx.difficulty === 'hard');
    const ok = v === prob.ans;
    if (ok) {
      pl.score += 10 + Math.min(10, pl.streak * 2);
      pl.streak++;
      pl.best = Math.max(pl.best, pl.streak);
      pl.right++;
    } else {
      pl.streak = 0;
      pl.wrong++;
      pl.score = Math.max(0, pl.score - 3);
    }
    pl.idx++;
    ctx.event('answer', { ok, ans: prob.ans }, pid);
  },
  pub(s) {
    return { endsAt: s.endsAt, scores: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, p.score])), right: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, p.right])) };
  },
  priv(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl) return null;
    return { problem: mathProblem(s.seed, pl.idx, ctx.difficulty === 'hard').text, idx: pl.idx, streak: pl.streak, right: pl.right, score: pl.score };
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    const prob = mathProblem(s.seed, pl.idx, ctx.difficulty === 'hard');
    const ok = Math.random() < ctx.diff(0.75, 0.85, 0.93);
    return { action: { t: 'answer', v: ok ? prob.ans : prob.ans + (Math.random() < 0.5 ? 1 : -1) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      perfs[id] = { score: p.score, perf: p.score / 420, participated: ctx.acted(id), bonuses: p.best >= 10 ? [{ label: `${p.best} in a row!`, pts: 40 }] : [], highlight: `${p.right} correct · ${p.wrong} wrong · streak ${p.best}` };
      if (p.right) records[id] = [{ key: 'solved', label: 'Most sums solved', value: p.right, better: 'higher', format: 'int' }];
    }
    return { perfs, records };
  },
});
