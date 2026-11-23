import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, reactionTime } from '../../engine/util';

const MAX_ERR = 2500;

interface S {
  attempt: number;
  targets: number[];
  phase: 'ready' | 'running' | 'reveal';
  startAt: number;
  stops: Record<string, number>; // elapsed ms
  history: Record<string, number[]>; // abs error per attempt
  timer: number | null;
  botAim: Record<string, number>;
}

export const stop5 = defineGame<S>({
  id: 'stop-5',
  botDelay: [40, 80],
  setup(ctx) {
    const t2 = Math.round((3 + ctx.rng.next() * 5) * 4) / 4;
    const t3 = Math.round((2.5 + ctx.rng.next() * 6.5) * 10) / 10;
    return { attempt: -1, targets: [5, t2, t3], phase: 'ready', startAt: 0, stops: {}, history: Object.fromEntries(ctx.ids.map((id) => [id, []])), timer: null, botAim: {} };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'stop' || s.phase !== 'running' || s.stops[pid] != null) return;
    ctx.markActed(pid);
    s.stops[pid] = reactionTime(ctx, pid, s.startAt, a.ms);
    if (ctx.ids.every((id) => s.stops[id] != null || !ctx.isConnected(id))) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(300, () => reveal(s, ctx));
    }
  },
  pub(s) {
    const target = s.targets[Math.max(0, s.attempt)];
    return {
      attempt: s.attempt,
      n: s.targets.length,
      target,
      phase: s.phase,
      startAt: s.startAt,
      stopped: Object.keys(s.stops),
      stops: s.phase === 'reveal' ? s.stops : null,
      totals: Object.fromEntries(Object.entries(s.history).map(([id, h]) => [id, h.reduce((x, y) => x + y, 0)])),
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.stops[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'running' || s.stops[pid] != null) return null;
    const target = s.targets[s.attempt] * 1000;
    const aim = (s.botAim[pid] ??= target + (Math.random() - 0.5) * ctx.diff(1600, 1000, 600));
    const el = ctx.now() - s.startAt;
    return el >= aim ? { action: { t: 'stop', ms: el } } : null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const h = s.history[id];
      const total = h.reduce((a, b) => a + b, 0);
      const best = Math.min(...h);
      const avg = total / Math.max(1, h.length);
      perfs[id] = {
        score: -total,
        perf: Math.max(0, 1 - avg / 1200),
        participated: ctx.acted(id),
        bonuses: best <= 30 ? [{ label: 'Human stopwatch (≤30 ms off)', pts: 50 }] : best <= 100 ? [{ label: 'Within 0.1 s!', pts: 25 }] : [],
        highlight: `avg ${(avg / 1000).toFixed(3)} s off · best ${(best / 1000).toFixed(3)} s`,
      };
      if (ctx.acted(id)) records[id] = [{ key: 'closest', label: 'Closest stop', value: best, better: 'lower', format: 'ms' }];
    }
    return { perfs, records };
  },
});

function next(s: S, ctx: GameCtx) {
  s.attempt++;
  if (s.attempt >= s.targets.length) return ctx.end();
  s.phase = 'ready';
  s.stops = {};
  s.botAim = {};
  ctx.dirty();
  s.timer = ctx.after(2200, () => {
    s.phase = 'running';
    s.startAt = ctx.now();
    ctx.dirty();
    s.timer = ctx.after(s.targets[s.attempt] * 1000 + MAX_ERR, () => reveal(s, ctx));
  });
}

function reveal(s: S, ctx: GameCtx) {
  const target = s.targets[s.attempt] * 1000;
  for (const id of ctx.ids) {
    const v = s.stops[id];
    s.history[id].push(v == null ? MAX_ERR : Math.min(MAX_ERR, Math.abs(v - target)));
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(3600, () => next(s, ctx));
}
