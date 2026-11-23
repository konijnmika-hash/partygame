import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, reactionTime, allDone } from '../../engine/util';
import { perfBetween } from '@shared/scoring';

const ROUNDS = 5;
const MISS = 1000;

interface S {
  round: number;
  phase: 'wait' | 'go' | 'gap';
  goAt: number;
  times: Record<string, number[]>;
  tapped: Record<string, boolean>;
  falseStarts: Record<string, number>;
  last: Record<string, number | 'early' | null>;
  timer: number | null;
  botAim: Record<string, number>;
}

export const lightningReflex = defineGame<S>({
  id: 'lightning-reflex',
  botDelay: [40, 80],
  setup(ctx) {
    const times: Record<string, number[]> = {};
    for (const id of ctx.ids) times[id] = [];
    return { round: 0, phase: 'wait', goAt: 0, times, tapped: {}, falseStarts: {}, last: {}, timer: null, botAim: {} };
  },
  start(s, ctx) {
    beginRound(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap' || s.tapped[pid]) return;
    if (s.phase === 'gap') return;
    ctx.markActed(pid);
    if (s.phase === 'wait' || a.early === true) {
      s.tapped[pid] = true;
      s.falseStarts[pid] = (s.falseStarts[pid] || 0) + 1;
      s.times[pid].push(MISS);
      s.last[pid] = 'early';
      ctx.event('false-start', null, pid);
    } else {
      const ms = Math.min(MISS, reactionTime(ctx, pid, s.goAt, a.ms));
      s.tapped[pid] = true;
      s.times[pid].push(ms);
      s.last[pid] = ms;
    }
    if (s.phase === 'go' && allDone(ctx, (id) => !!s.tapped[id])) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(500, () => endRound(s, ctx));
    }
  },
  pub(s, ctx) {
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      goAt: s.phase === 'go' ? s.goAt : 0,
      tapped: ctx.ids.filter((id) => s.tapped[id]),
      last: s.phase === 'gap' ? s.last : {},
      best: Object.fromEntries(ctx.ids.map((id) => [id, bestOf(s.times[id])])),
    };
  },
  bot(s, ctx, pid) {
    if (s.tapped[pid]) return null;
    if (s.phase === 'wait') return Math.random() < 0.004 ? { action: { t: 'tap' } } : null;
    if (s.phase !== 'go') return null;
    const aim = (s.botAim[pid] ??= ctx.diff(420, 320, 250) + Math.random() * 120);
    const elapsed = ctx.now() - s.goAt;
    if (elapsed < aim) return null;
    return { action: { t: 'tap', ms: elapsed } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    const stats: Record<string, Record<string, number>> = {};
    let fastest: [string, number] | null = null;
    for (const id of ctx.ids) {
      const t = s.times[id];
      while (t.length < ROUNDS) t.push(MISS);
      const avg = t.reduce((a, b) => a + b, 0) / t.length;
      const best = Math.min(...t);
      const bonuses = [];
      if (!s.falseStarts[id] && t.every((x) => x < MISS)) bonuses.push({ label: 'No false starts', pts: 20 });
      if (best < 200) bonuses.push({ label: 'Sub-200 ms!', pts: 30 });
      perfs[id] = { score: -avg, perf: perfBetween(avg, 650, 230), participated: ctx.acted(id), bonuses, highlight: `avg ${Math.round(avg)} ms · best ${best >= MISS ? '—' : best + ' ms'}` };
      if (best < MISS) {
        records[id] = [
          { key: 'best', label: 'Fastest reaction', value: best, better: 'lower', format: 'ms' },
          { key: 'avg', label: 'Best average', value: Math.round(avg), better: 'lower', format: 'ms' },
        ];
        stats[id] = { reactionMs: best };
        if (!fastest || best < fastest[1]) fastest = [id, best];
      }
    }
    return { perfs, records, stats, summary: fastest ? [`⚡ Fastest tap: ${ctx.name(fastest[0])} at ${fastest[1]} ms`] : [] };
  },
});

function bestOf(t: number[]): number | null {
  const ok = t.filter((x) => x < MISS);
  return ok.length ? Math.min(...ok) : null;
}

function beginRound(s: S, ctx: GameCtx) {
  s.phase = 'wait';
  s.tapped = {};
  s.last = {};
  s.botAim = {};
  const wait = ctx.diff(2200, 1600, 1200) + ctx.rng.next() * ctx.diff(2600, 3200, 3800);
  s.timer = ctx.after(wait, () => {
    s.phase = 'go';
    s.goAt = ctx.now();
    ctx.dirty();
    s.timer = ctx.after(2000, () => endRound(s, ctx));
  });
}

function endRound(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) {
    if (!s.tapped[id]) {
      s.times[id].push(MISS);
      s.last[id] = null;
    }
  }
  s.phase = 'gap';
  ctx.dirty();
  s.timer = ctx.after(1800, () => {
    s.round++;
    if (s.round >= ROUNDS) ctx.end();
    else beginRound(s, ctx);
  });
}
