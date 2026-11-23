import { defineGame } from '../../engine/types';
import { isObj, str } from '../../engine/util';
import { createRng } from '@shared/rng';

const LIMIT = 90_000;
const LIVES = 3;

/** The number shown for a given length + attempt (same for all players). */
function digitsFor(seed: number, len: number, attempt: number): string {
  const r = createRng(seed + len * 1009 + attempt * 7);
  let s = String(r.int(1, 9));
  while (s.length < len) s += String(r.int(0, 9));
  return s;
}

interface P {
  len: number;
  attempt: number;
  lives: number;
  phase: 'show' | 'input' | 'feedback' | 'out';
  until: number;
  best: number;
  last: { ok: boolean; was: string } | null;
}
interface S {
  seed: number;
  endsAt: number;
  p: Record<string, P>;
}

export const flashMemory = defineGame<S>({
  id: 'flash-memory',
  botDelay: [900, 1800],
  setup(ctx) {
    const start = ctx.diff(3, 4, 5);
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { len: start, attempt: 0, lives: LIVES, phase: 'show', until: 0, best: start - 1, last: null };
    return { seed: ctx.rng.int(1, 1e9), endsAt: 0, p };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(LIMIT);
    for (const pl of Object.values(s.p)) pl.until = ctx.now() + showMs(pl.len);
    ctx.after(ctx.ms(LIMIT), () => ctx.end());
  },
  tick(s, ctx) {
    const now = ctx.now();
    for (const pl of Object.values(s.p)) {
      if (pl.phase === 'show' && now >= pl.until) pl.phase = 'input';
      else if (pl.phase === 'feedback' && now >= pl.until) {
        pl.phase = 'show';
        pl.until = now + showMs(pl.len);
      }
    }
    if (ctx.ids.every((id) => s.p[id].phase === 'out' || !ctx.isConnected(id))) ctx.end();
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'answer') return;
    const pl = s.p[pid];
    if (!pl || pl.phase !== 'input') return;
    const v = (str(a.v, 20) ?? '').replace(/\D/g, '');
    ctx.markActed(pid);
    const want = digitsFor(s.seed, pl.len, pl.attempt);
    const ok = v === want;
    pl.last = { ok, was: want };
    if (ok) {
      pl.best = Math.max(pl.best, pl.len);
      pl.len++;
      pl.attempt = 0;
    } else {
      pl.lives--;
      pl.attempt++;
    }
    if (pl.lives <= 0) pl.phase = 'out';
    else {
      pl.phase = 'feedback';
      pl.until = ctx.now() + 1300;
    }
  },
  pub(s) {
    return { endsAt: s.endsAt, p: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, { best: p.best, lives: p.lives, out: p.phase === 'out' }])) };
  },
  priv(s, _ctx, pid) {
    const pl = s.p[pid];
    if (!pl) return null;
    return { phase: pl.phase, len: pl.len, lives: pl.lives, digits: pl.phase === 'show' ? digitsFor(s.seed, pl.len, pl.attempt) : null, until: pl.until, last: pl.phase === 'feedback' || pl.phase === 'out' ? pl.last : null, best: pl.best };
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl || pl.phase !== 'input') return null;
    const want = digitsFor(s.seed, pl.len, pl.attempt);
    const ok = Math.random() < Math.max(0.1, 1 - (pl.len - ctx.diff(4, 5, 6)) * 0.2);
    return { action: { t: 'answer', v: ok ? want : want.slice(0, -1) + ((Number(want.slice(-1)) + 1) % 10) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      perfs[id] = { score: p.best * 10 + p.lives, perf: Math.max(0, (p.best - 2) / 9), participated: ctx.acted(id), bonuses: p.best >= 10 ? [{ label: '10-digit brain', pts: 50 }] : [], highlight: `Remembered ${p.best} digits` };
      if (ctx.acted(id)) records[id] = [{ key: 'digits', label: 'Longest number', value: p.best, better: 'higher', format: 'int' }];
    }
    return { perfs, records };
  },
});

function showMs(len: number): number {
  return 700 + len * 280;
}
