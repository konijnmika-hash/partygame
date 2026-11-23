// Collect the Coins: coins and gems pop up around the arena. Dash into rivals to knock coins
// out of them. Most coins at the buzzer wins.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dash, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const CC = { W: 1000, H: 700, R: 26, PICK: 36 } as const;
const DURATION = 50_000;
const DASH_CD = 1400;
const DASH_MS = 240;
const MAX_COINS = 16;

interface P {
  b: Body;
  coins: number;
  dashAt: number;
  stunUntil: number;
  knocked: number;
  lost: number;
  gems: number;
}

interface Coin { id: number; x: number; y: number; v: number; vx: number; vy: number; noPick: string | null; noPickUntil: number; born: number }

interface S {
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  coins: Coin[];
  seq: number;
  nextCoin: number;
  fx: { k: 'pick' | 'knock'; x: number; y: number; at: number; v: number }[];
}

export const collectCoins = defineGame<S>({
  id: 'collect-coins',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, CC.W / 2 + Math.cos(a) * 300, CC.H / 2 + Math.sin(a) * 220, CC.R), coins: 0, dashAt: -99999, stunUntil: 0, knocked: 0, lost: 0, gems: 0 };
    });
    return { endsAt: 0, p, inputs: {}, btn: new Buttons(), coins: [], seq: 0, nextCoin: 0, fx: [] };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
    for (let i = 0; i < 6; i++) spawn(s, ctx);
    s.nextCoin = ctx.now() + 400;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    if (now >= s.nextCoin) {
      if (s.coins.length < MAX_COINS + ctx.ids.length) spawn(s, ctx);
      s.nextCoin = now + 520 / (1 + ctx.ids.length / 6);
    }
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const f = pl.stunUntil > now ? undefined : s.inputs[id];
      steer(pl.b, f, dt, 1600, 330, 3.4);
      if (f && s.btn.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 620);
      }
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.9, (a, b, impact) => {
      if (impact < 200) return;
      const pa = s.p[a.id];
      const pb = s.p[b.id];
      const aDash = now - pa.dashAt < DASH_MS;
      const bDash = now - pb.dashAt < DASH_MS;
      if (aDash && !bDash) knock(s, ctx, b.id, a.id);
      else if (bDash && !aDash) knock(s, ctx, a.id, b.id);
    });
    for (const id of ctx.ids) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, CC.W, CC.H, 0.5);
    }
    // scattered coins slide to a stop
    for (const c of s.coins) {
      if (c.vx || c.vy) {
        c.x = Math.max(20, Math.min(CC.W - 20, c.x + c.vx * dt));
        c.y = Math.max(20, Math.min(CC.H - 20, c.y + c.vy * dt));
        const k = Math.max(0, 1 - 4 * dt);
        c.vx *= k;
        c.vy *= k;
        if (Math.abs(c.vx) + Math.abs(c.vy) < 4) c.vx = c.vy = 0;
      }
    }
    // pick-ups
    for (const id of ctx.ids) {
      const b = s.p[id].b;
      for (const c of s.coins) {
        if (c.v === 0) continue;
        if (c.noPick === id && now < c.noPickUntil) continue;
        if (now - c.born < 250) continue;
        if (Math.hypot(b.x - c.x, b.y - c.y) < CC.PICK) {
          s.p[id].coins += c.v;
          if (c.v >= 5) s.p[id].gems++;
          s.fx.push({ k: 'pick', x: r1(c.x), y: r1(c.y), at: now, v: c.v });
          c.v = 0;
        }
      }
    }
    s.coins = s.coins.filter((c) => c.v > 0);
    s.fx = s.fx.filter((f) => now - f.at < 600);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), c: pl.coins, d: now - pl.dashAt < DASH_MS ? 1 : 0, st: pl.stunUntil > now ? 1 : 0, cd: Math.max(0, Math.round(DASH_CD - (now - pl.dashAt))) };
      }),
      o: s.coins.map((c) => ({ id: c.id, x: r1(c.x), y: r1(c.y), v: c.v })),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].coins])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.stunUntil > now) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    // rich rival close by and dash ready: go for the knock
    if (now - me.dashAt > DASH_CD) {
      for (const id of ctx.ids) {
        if (id === pid) continue;
        const o = s.p[id];
        if (o.coins >= 4 && dist(me.b, o.b) < ctx.diff(110, 150, 180) && Math.random() < skill * 0.5) {
          const inp = seek(me.b, o.b, 0.05);
          inp.b = 1;
          return { input: inp };
        }
      }
    }
    let best: Coin | null = null;
    let bs = -Infinity;
    for (const c of s.coins) {
      if (c.noPick === pid && now < c.noPickUntil) continue;
      const d = Math.hypot(c.x - me.b.x, c.y - me.b.y);
      // prefer valuable, close coins that rivals are not about to grab
      let rivalCloser = 0;
      for (const id of ctx.ids) if (id !== pid && dist(s.p[id].b, c) < d * 0.7) rivalCloser = 1;
      const sc = c.v * 120 - d - rivalCloser * 150 * skill + (Math.random() - 0.5) * (1 - skill) * 200;
      if (sc > bs) {
        bs = sc;
        best = c;
      }
    }
    if (!best) return { input: { x: 0, y: 0, b: 0 } };
    return { input: seek(me.b, best, (1 - skill) * 0.5) };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const top = Math.max(5, ...ctx.ids.map((id) => s.p[id].coins));
    for (const id of ctx.ids) {
      const pl = s.p[id];
      perfs[id] = {
        score: pl.coins,
        perf: Math.min(1, pl.coins / top),
        participated: ctx.acted(id),
        highlight: `🪙 ${pl.coins} coins · 💎 ${pl.gems} gems · knocked ${pl.knocked} rival${pl.knocked === 1 ? '' : 's'}`,
        bonuses: pl.lost === 0 && pl.coins > 0 ? [{ label: 'Never robbed', pts: 25 }] : [],
      };
    }
    return { perfs, records: Object.fromEntries(ctx.ids.map((id) => [id, [{ key: 'coins', label: 'Most coins collected', value: s.p[id].coins, better: 'higher' as const, format: 'int' as const }]])) };
  },
});

function spawn(s: S, ctx: GameCtx) {
  const gem = ctx.rng.chance(0.1);
  s.coins.push({ id: ++s.seq, x: r1(50 + ctx.rng.next() * (CC.W - 100)), y: r1(50 + ctx.rng.next() * (CC.H - 100)), v: gem ? 5 : 1, vx: 0, vy: 0, noPick: null, noPickUntil: 0, born: ctx.now() });
}

function knock(s: S, ctx: GameCtx, victim: string, by: string) {
  const now = ctx.now();
  const pv = s.p[victim];
  if (pv.stunUntil > now) return;
  pv.stunUntil = now + 500;
  s.p[by].knocked++;
  const drop = Math.min(5, Math.max(pv.coins > 0 ? 1 : 0, Math.floor(pv.coins * 0.3)));
  if (!drop) return;
  pv.coins -= drop;
  pv.lost += drop;
  for (let i = 0; i < drop; i++) {
    const a = ctx.rng.next() * Math.PI * 2;
    const sp = 220 + ctx.rng.next() * 200;
    s.coins.push({ id: ++s.seq, x: pv.b.x, y: pv.b.y, v: 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, noPick: victim, noPickUntil: now + 900, born: now });
  }
  s.fx.push({ k: 'knock', x: r1(pv.b.x), y: r1(pv.b.y), at: now, v: drop });
  ctx.event('knock', { victim, by, drop });
}
