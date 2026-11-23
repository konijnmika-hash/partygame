import { defineGame } from '../../engine/types';
import { createRng } from '@shared/rng';
import { isObj, intArray } from '../../engine/util';

const LIMIT = 90_000;
const LIVES = 3;

/** Level L: grid size + number of lit cells (deterministic per seed so everyone gets the same patterns). */
export function patternFor(seed: number, level: number): { size: number; cells: number[] } {
  const size = level < 3 ? 3 : level < 6 ? 4 : level < 10 ? 5 : 6;
  const count = Math.min(size * size - 2, 3 + level);
  const rng = createRng(seed + level * 31337);
  return { size, cells: rng.sample(Array.from({ length: size * size }, (_, i) => i), count).sort((a, b) => a - b) };
}

interface P {
  level: number;
  lives: number;
  phase: 'show' | 'input' | 'out' | 'feedback';
  showUntil: number;
  best: number;
  lastOk: boolean | null;
}
interface S {
  seed: number;
  endsAt: number;
  p: Record<string, P>;
}

export const patternMemory = defineGame<S>({
  id: 'pattern-memory',
  botDelay: [900, 1800],
  setup(ctx) {
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { level: 0, lives: LIVES, phase: 'show', showUntil: 0, best: 0, lastOk: null };
    return { seed: ctx.rng.int(1, 1e9), endsAt: 0, p };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(LIMIT);
    for (const id of ctx.ids) show(s, ctx.now(), id, ctx.diff(1900, 1500, 1100));
    ctx.after(ctx.ms(LIMIT), () => ctx.end());
  },
  tick(s, ctx) {
    const now = ctx.now();
    for (const pl of Object.values(s.p)) {
      if (pl.phase === 'show' && now >= pl.showUntil) pl.phase = 'input';
      if (pl.phase === 'feedback' && now >= pl.showUntil) {
        pl.phase = 'show';
        pl.showUntil = now + ctx.diff(1900, 1500, 1100) + pl.level * 60;
      }
    }
    if (ctx.ids.every((id) => s.p[id].phase === 'out' || !ctx.isConnected(id))) ctx.end();
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'submit') return;
    const pl = s.p[pid];
    if (!pl || pl.phase !== 'input') return;
    const pat = patternFor(s.seed, pl.level);
    const cells = intArray(a.cells, 40, 0, pat.size * pat.size - 1);
    if (!cells) return;
    ctx.markActed(pid);
    const got = [...new Set(cells)].sort((x, y) => x - y);
    const ok = got.length === pat.cells.length && got.every((c, i) => c === pat.cells[i]);
    pl.lastOk = ok;
    if (ok) {
      pl.level++;
      pl.best = Math.max(pl.best, pl.level);
    } else {
      pl.lives--;
    }
    if (pl.lives <= 0) pl.phase = 'out';
    else {
      pl.phase = 'feedback';
      pl.showUntil = ctx.now() + 900;
    }
    ctx.event('result', { ok, answer: pat.cells }, pid);
  },
  pub(s) {
    return { endsAt: s.endsAt, levels: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, { level: p.level, lives: p.lives, out: p.phase === 'out' }])) };
  },
  priv(s, _ctx, pid) {
    const pl = s.p[pid];
    if (!pl) return null;
    const pat = patternFor(s.seed, pl.level);
    return { level: pl.level, lives: pl.lives, phase: pl.phase, size: pat.size, lit: pl.phase === 'show' ? pat.cells : null, need: pat.cells.length, showUntil: pl.showUntil };
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl || pl.phase !== 'input') return null;
    const pat = patternFor(s.seed, pl.level);
    const skill = ctx.diff(0.8, 0.86, 0.92) - pl.level * 0.03;
    const cells = Math.random() < skill ? pat.cells : [...pat.cells.slice(1), (pat.cells[0] + 1) % (pat.size * pat.size)];
    return { action: { t: 'submit', cells } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      perfs[id] = { score: p.level * 10 + p.lives, perf: p.level / 12, participated: ctx.acted(id), bonuses: p.lives === LIVES && p.level >= 6 ? [{ label: 'No mistakes', pts: 40 }] : [], highlight: `Reached level ${p.level + 1} · ${p.lives} lives left` };
      if (p.level) records[id] = [{ key: 'level', label: 'Highest pattern level', value: p.level, better: 'higher', format: 'int' }];
    }
    return { perfs, records };
  },
});

function show(s: S, now: number, id: string, ms: number) {
  const pl = s.p[id];
  pl.phase = 'show';
  pl.showUntil = now + ms;
}
