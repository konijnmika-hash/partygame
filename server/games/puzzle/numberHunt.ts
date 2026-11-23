import { defineGame } from '../../engine/types';
import { isObj, int } from '../../engine/util';
import { createRng } from '@shared/rng';

const N = 25;
const ROUNDS = 2;
const LIMIT = 90_000;

interface P {
  round: number;
  next: number;
  frozen: number;
  times: number[];
  roundStart: number;
  mistakes: number;
}
interface S {
  seed: number;
  base: number[];
  p: Record<string, P>;
  endsAt: number;
}

/** Grid layout for a player: round 1 fixed, round 2 reshuffles after every correct tap. */
function gridFor(s: S, pl: P): number[] {
  if (pl.round === 0) return s.base;
  return createRng(s.seed + pl.next * 104729).shuffle(s.base);
}

export const numberHunt = defineGame<S>({
  id: 'number-hunt',
  botDelay: [500, 1200],
  setup(ctx) {
    const base = ctx.rng.shuffle(Array.from({ length: N }, (_, i) => i + 1));
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { round: 0, next: 1, frozen: 0, times: [], roundStart: 0, mistakes: 0 };
    return { seed: ctx.rng.int(1, 1e9), base, p, endsAt: 0 };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(LIMIT);
    for (const pl of Object.values(s.p)) pl.roundStart = ctx.now();
    ctx.after(ctx.ms(LIMIT), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap') return;
    const pl = s.p[pid];
    if (!pl || pl.round >= ROUNDS || pl.frozen > ctx.now()) return;
    const n = int(a.n, 1, N);
    if (n == null) return;
    ctx.markActed(pid);
    if (n !== pl.next) {
      pl.frozen = ctx.now() + 800;
      pl.mistakes++;
      ctx.event('wrong', null, pid);
      return;
    }
    pl.next++;
    if (pl.next > N) {
      pl.times.push(ctx.now() - pl.roundStart);
      pl.round++;
      pl.next = 1;
      pl.roundStart = ctx.now();
      ctx.event('round', { round: pl.round }, pid);
      if (ctx.ids.every((id) => s.p[id].round >= ROUNDS || !ctx.isConnected(id))) ctx.after(800, () => ctx.end());
    }
  },
  pub(s) {
    return { endsAt: s.endsAt, rounds: ROUNDS, progress: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, { round: p.round, next: p.next }])) };
  },
  priv(s, _ctx, pid) {
    const pl = s.p[pid];
    if (!pl) return null;
    return { grid: gridFor(s, pl), next: pl.next, round: pl.round, frozenUntil: pl.frozen, times: pl.times };
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl || pl.round >= ROUNDS) return null;
    return { action: { t: 'tap', n: Math.random() < ctx.diff(0.8, 0.88, 0.95) ? pl.next : ctx.rng.int(1, N) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      const progress = p.round * N + (p.round < ROUNDS ? p.next - 1 : 0);
      const total = p.times.reduce((a, b) => a + b, 0);
      perfs[id] = {
        score: progress * 1_000_000 - total,
        perf: (progress / (N * ROUNDS)) * 0.6 + (p.round === ROUNDS ? Math.max(0, 1 - total / 80_000) * 0.4 : 0),
        participated: ctx.acted(id),
        bonuses: p.mistakes === 0 && p.round === ROUNDS ? [{ label: 'No mis-taps', pts: 30 }] : [],
        highlight: p.round === ROUNDS ? `Both boards in ${(total / 1000).toFixed(1)} s` : `Reached ${progress}/${N * ROUNDS}`,
      };
      if (p.times[0]) records[id] = [{ key: 'board1', label: 'Fastest 1→25', value: p.times[0], better: 'lower', format: 'sec' }];
    }
    return { perfs, records };
  },
});
