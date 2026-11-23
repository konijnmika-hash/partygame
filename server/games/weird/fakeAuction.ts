// Fake Auction: absurd junk goes under the hammer. Some players get secret appraisal tips. Bid
// with your 1000 coins; values are revealed at the end — the richest Bloop wins.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { AUCTION_ITEMS } from '../../content/weird';

const START_COINS = 1000;
const HAMMER_MS = 5000;
const MIN_LOT_MS = 9000;
const MAX_LOT_MS = 22_000;
const INCS = [20, 50, 100];

interface Lot { name: string; emoji: string; desc: string; value: number; lo: number; hi: number }
interface Tip { lot: number; text: string }

interface S {
  lots: Lot[];
  i: number;
  phase: 'intro' | 'bid' | 'sold' | 'final';
  lotStart: number;
  hammerAt: number;
  bid: number;
  leader: string | null;
  coins: Record<string, number>;
  won: Record<string, number[]>;
  paid: Record<number, number>;
  tips: Record<string, Tip[]>;
  bids: Record<string, number>;
  timer: number | null;
}

export const fakeAuction = defineGame<S>({
  id: 'fake-auction',
  botDelay: [600, 1400],
  setup(ctx) {
    const count = ctx.ids.length <= 3 ? 6 : 7;
    const lots: Lot[] = ctx.rng.sample(AUCTION_ITEMS, count).map((it) => ({ ...it, value: Math.round((it.lo + ctx.rng.next() * (it.hi - it.lo)) / 10) * 10 }));
    // deal appraisal tips: each lot gets tipped to roughly 40% of the players
    const tips: Record<string, Tip[]> = Object.fromEntries(ctx.ids.map((id) => [id, []]));
    lots.forEach((lot, k) => {
      for (const id of ctx.ids) {
        if (!ctx.rng.chance(0.4)) continue;
        const r = ctx.rng.next();
        let text: string;
        if (r < 0.4) {
          const a = Math.round((lot.value - 60 - ctx.rng.next() * 120) / 10) * 10;
          const b = Math.round((lot.value + 60 + ctx.rng.next() * 120) / 10) * 10;
          text = `${lot.emoji} ${lot.name}: worth between ${a} and ${b}`;
        } else if (r < 0.7) {
          const x = Math.round((lot.value - 50 - ctx.rng.next() * 150) / 10) * 10;
          text = `${lot.emoji} ${lot.name}: worth MORE than ${x}`;
        } else {
          const x = Math.round((lot.value + 50 + ctx.rng.next() * 150) / 10) * 10;
          text = `${lot.emoji} ${lot.name}: worth LESS than ${x}`;
        }
        tips[id].push({ lot: k, text });
      }
    });
    return {
      lots,
      i: -1,
      phase: 'intro',
      lotStart: 0,
      hammerAt: 0,
      bid: 0,
      leader: null,
      coins: Object.fromEntries(ctx.ids.map((id) => [id, START_COINS])),
      won: Object.fromEntries(ctx.ids.map((id) => [id, []])),
      paid: {},
      tips,
      bids: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    s.phase = 'intro';
    s.hammerAt = ctx.now() + 4000;
    ctx.dirty();
    s.timer = ctx.after(4000, () => nextLot(s, ctx));
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'bid' || s.phase !== 'bid') return;
    const inc = a.inc;
    if (!INCS.includes(inc)) return;
    if (s.leader === pid) return;
    const amt = s.bid + inc;
    if (amt > s.coins[pid]) return;
    const now = ctx.now();
    ctx.markActed(pid);
    s.bid = amt;
    s.leader = pid;
    s.bids[pid]++;
    s.hammerAt = Math.min(s.lotStart + MAX_LOT_MS, Math.max(s.lotStart + MIN_LOT_MS, now + HAMMER_MS));
    ctx.cancel(s.timer);
    s.timer = ctx.after(s.hammerAt - now, () => sell(s, ctx));
    ctx.event('bid', { id: pid, amt });
    ctx.dirty();
  },
  pub(s) {
    const lot = s.lots[s.i];
    return {
      i: s.i,
      n: s.lots.length,
      phase: s.phase,
      hammerAt: s.hammerAt,
      lot: lot ? { name: lot.name, emoji: lot.emoji, desc: lot.desc } : null,
      bid: s.bid,
      leader: s.leader,
      coins: s.coins,
      won: s.won,
      paid: s.paid,
      lots: s.phase === 'final' ? s.lots.map((l) => ({ name: l.name, emoji: l.emoji, value: l.value })) : s.lots.map((l) => ({ name: l.name, emoji: l.emoji })),
      incs: INCS,
    };
  },
  priv(s, _ctx, pid) {
    return { tips: s.tips[pid] ?? [] };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'bid' || s.leader === pid) return null;
    const lot = s.lots[s.i];
    const skill = ctx.diff(0.4, 0.6, 0.8);
    // estimate from tips (if any) or the catalogue range, with some noise
    let est = (lot.lo + lot.hi) / 2;
    const tip = (s.tips[pid] ?? []).find((t) => t.lot === s.i);
    if (tip) est = lot.value + (Math.random() - 0.5) * 140 * (1.2 - skill);
    est += (Math.random() - 0.5) * 200 * (1 - skill);
    const inc = INCS[Math.floor(Math.random() * INCS.length)];
    const amt = s.bid + inc;
    // keep some money back for later lots
    const lotsLeft = s.lots.length - s.i;
    const budget = s.coins[pid] - (lotsLeft > 1 ? 100 : 0);
    if (amt <= est * (0.75 + skill * 0.2) && amt <= budget && Math.random() < 0.6) return { action: { t: 'bid', inc } };
    return null;
  },
  results(s, ctx) {
    const worth = (id: string) => s.coins[id] + s.won[id].reduce((a, k) => a + s.lots[k].value, 0);
    const best = Math.max(1, ...ctx.ids.map(worth));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const w = worth(id);
      const items = s.won[id].map((k) => s.lots[k]);
      const profit = items.reduce((a, l, j) => a + l.value - (s.paid[s.won[id][j]] ?? 0), 0);
      perfs[id] = {
        score: w,
        perf: Math.max(0, Math.min(1, (w - 600) / Math.max(1, best - 600))),
        participated: ctx.acted(id),
        highlight: `Final wealth ${w} 🪙 · ${items.length ? items.map((l) => l.emoji).join(' ') : 'bought nothing'} · ${profit >= 0 ? '+' : ''}${profit} profit`,
        bonuses: items.some((l, j) => l.value > (s.paid[s.won[id][j]] ?? 0) * 2 && l.value > 200) ? [{ label: 'Bargain hunter', pts: 30 }] : [],
      };
    }
    const top = s.lots.reduce((a, l) => (l.value > a.value ? l : a));
    return { perfs, summary: [`💎 Best lot: ${top.emoji} ${top.name} (${top.value} coins)`] };
  },
});

function nextLot(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= s.lots.length) {
    s.phase = 'final';
    ctx.dirty();
    s.timer = ctx.after(6500, () => ctx.end());
    return;
  }
  const now = ctx.now();
  s.phase = 'bid';
  s.bid = 0;
  s.leader = null;
  s.lotStart = now;
  s.hammerAt = now + ctx.ms(MIN_LOT_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(s.hammerAt - now, () => sell(s, ctx));
  ctx.dirty();
}

function sell(s: S, ctx: GameCtx) {
  if (s.phase !== 'bid') return;
  if (s.leader) {
    s.coins[s.leader] -= s.bid;
    s.won[s.leader].push(s.i);
    s.paid[s.i] = s.bid;
    ctx.event('sold', { id: s.leader, amt: s.bid });
  } else ctx.event('sold', { id: null, amt: 0 });
  s.phase = 'sold';
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(2600, () => nextLot(s, ctx));
}
