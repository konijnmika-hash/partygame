// Ridiculous Ranking: rank four absurd things by a silly criterion. You score for matching the
// group's average ranking — think like the crowd!
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, intArray } from '../../engine/util';
import { RANKINGS } from '../../content/weird';

const ROUNDS = 5;
const RANK_MS = 25_000;
const REVEAL_MS = 5500;

interface S {
  r: number;
  phase: 'rank' | 'reveal';
  deadline: number;
  /** items in display order (shuffled) and each one's consensus position (for bots) */
  sets: { q: string; items: [string, string][]; consensus: number[] }[];
  orders: Record<string, number[]>;
  avg: number[] | null;
  gains: Record<string, number>;
  scores: Record<string, number>;
  exact: Record<string, number>;
  timer: number | null;
}

export const ridiculousRanking = defineGame<S>({
  id: 'ridiculous-ranking',
  botDelay: [3000, 8000],
  setup(ctx) {
    // items are shown in a shuffled order; `items` keeps the consensus order for bots
    return {
      r: -1,
      phase: 'rank',
      deadline: 0,
      sets: ctx.rng.sample(RANKINGS, ROUNDS).map((set) => {
        const perm = ctx.rng.shuffle([0, 1, 2, 3]);
        return { q: set.q, items: perm.map((i) => set.items[i]), consensus: perm };
      }),
      orders: {},
      avg: null,
      gains: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      exact: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'rank' || s.phase !== 'rank' || s.orders[pid]) return;
    const o = intArray(a.order, 4, 0, 3);
    if (!o || o.length !== 4 || new Set(o).size !== 4) return;
    ctx.markActed(pid);
    s.orders[pid] = o;
    if (allDone(ctx, (id) => !!s.orders[id])) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(400, () => reveal(s, ctx));
    }
    ctx.dirty();
  },
  pub(s) {
    const set = s.sets[s.r];
    return {
      r: s.r,
      n: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      q: set?.q,
      items: set?.items.map(([name, emoji]) => ({ name, emoji })),
      submitted: Object.keys(s.orders),
      avg: s.phase === 'reveal' ? s.avg : null,
      orders: s.phase === 'reveal' ? s.orders : null,
      gains: s.phase === 'reveal' ? s.gains : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.orders[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'rank' || s.orders[pid]) return null;
    // bots lean toward the "consensus" order with personal quirks
    const noise = ctx.diff(1.6, 1.2, 0.9);
    const cons = s.sets[s.r].consensus;
    const keyed = [0, 1, 2, 3].map((i) => ({ i, k: cons[i] + (Math.random() - 0.5) * noise * 2 }));
    keyed.sort((a, b) => a.k - b.k);
    return { action: { t: 'rank', order: keyed.map((x) => x.i) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / (ROUNDS * 100)),
        participated: ctx.acted(id),
        highlight: `In tune with the crowd: ${Math.round((s.scores[id] / (ROUNDS * 100)) * 100)}% · ${s.exact[id]} perfect match${s.exact[id] === 1 ? '' : 'es'}`,
      };
    }
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.r++;
  if (s.r >= ROUNDS) return ctx.end();
  s.phase = 'rank';
  s.orders = {};
  s.avg = null;
  s.gains = {};
  s.deadline = ctx.now() + ctx.ms(RANK_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(RANK_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase !== 'rank') return;
  // order[k] = item at position k; average position per item
  const entries = Object.values(s.orders);
  const pos = [0, 0, 0, 0];
  for (const o of entries) o.forEach((item, k) => (pos[item] += k));
  s.avg = entries.length ? pos.map((p) => Math.round((p / entries.length) * 100) / 100) : [0, 1, 2, 3];
  const groupOrder = [0, 1, 2, 3].sort((a, b) => s.avg![a] - s.avg![b]);
  for (const [id, o] of Object.entries(s.orders)) {
    let dist = 0;
    o.forEach((item, k) => (dist += Math.abs(k - s.avg![item])));
    // max possible distance is 8; map to 0..100
    const g = Math.max(0, Math.round(100 - dist * 14));
    s.gains[id] = g;
    s.scores[id] += g;
    if (o.every((item, k) => item === groupOrder[k])) s.exact[id]++;
  }
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
