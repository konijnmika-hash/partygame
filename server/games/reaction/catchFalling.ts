import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { r1 } from '../../engine/arena';

const W = 1000;
const CATCH_Y = 500;
const HALF = 58;
const SPEED = 560;
const DURATION = 60_000;
const KINDS = { apple: 1, banana: 1, cherry: 2, gold: 5, bomb: -3 } as const;
type Kind = keyof typeof KINDS;

interface P {
  x: number;
  vx: number;
  stun: number;
  score: number;
  caught: number;
  bombs: number;
}
interface O {
  id: number;
  x: number;
  y: number;
  vy: number;
  k: Kind;
}
interface S {
  endsAt: number;
  p: Record<string, P>;
  o: O[];
  seq: number;
  nextSpawn: number;
  fx: { x: number; k: Kind; pid: string; at: number }[];
  inputs: Record<string, InputFrame>;
}

export const catchFalling = defineGame<S>({
  id: 'catch-falling',
  realtime: true,
  botDelay: [100, 180],
  setup(ctx) {
    const p: Record<string, P> = {};
    ctx.ids.forEach((id, i) => {
      p[id] = { x: ((i + 1) * W) / (ctx.ids.length + 1), vx: 0, stun: 0, score: 0, caught: 0, bombs: 0 };
    });
    return { endsAt: 0, p, o: [], seq: 0, nextSpawn: 0, fx: [], inputs: {} };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
    s.nextSpawn = ctx.now() + 600;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    const elapsedFrac = 1 - (s.endsAt - now) / ctx.ms(DURATION);
    // spawn
    if (now >= s.nextSpawn) {
      spawn(s, ctx, elapsedFrac);
      const every = ctx.diff(620, 480, 380) / (1 + Math.min(1.2, ctx.ids.length / 6)) * (1 - elapsedFrac * 0.35);
      s.nextSpawn = now + every + ctx.rng.next() * every;
    }
    // move baskets
    for (const [id, pl] of Object.entries(s.p)) {
      const f = s.inputs[id];
      const target = pl.stun > now ? 0 : (f?.x ?? 0) * SPEED;
      pl.vx += (target - pl.vx) * Math.min(1, dt * 12);
      pl.x = Math.max(HALF, Math.min(W - HALF, pl.x + pl.vx * dt));
    }
    // basket bumping
    const list = Object.values(s.p).sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i];
      const b = list[i + 1];
      const min = HALF * 1.7;
      if (b.x - a.x < min) {
        const push = (min - (b.x - a.x)) / 2;
        a.x = Math.max(HALF, a.x - push);
        b.x = Math.min(W - HALF, b.x + push);
      }
    }
    // fall + catch
    const g = ctx.diff(200, 240, 290);
    for (const o of s.o) {
      const prevY = o.y;
      o.vy += g * dt;
      o.y += o.vy * dt;
      if (prevY < CATCH_Y && o.y >= CATCH_Y) {
        let best: [string, number] | null = null;
        for (const [id, pl] of Object.entries(s.p)) {
          const d = Math.abs(pl.x - o.x);
          if (d < HALF + 8 && (!best || d < best[1])) best = [id, d];
        }
        if (best) {
          const pl = s.p[best[0]];
          pl.score += KINDS[o.k];
          if (o.k === 'bomb') {
            pl.stun = now + 1500;
            pl.bombs++;
            ctx.event('boom', { x: o.x }, best[0]);
          } else pl.caught++;
          s.fx.push({ x: o.x, k: o.k, pid: best[0], at: now });
          o.y = 9999;
        }
      }
    }
    s.o = s.o.filter((o) => o.y < 680);
    s.fx = s.fx.filter((f) => now - f.at < 700);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      p: Object.entries(s.p).map(([id, pl]) => ({ id, x: r1(pl.x), st: pl.stun > now ? 1 : 0, sc: pl.score })),
      o: s.o.map((o) => ({ id: o.id, x: r1(o.x), y: r1(o.y), k: o.k })),
      fx: s.fx,
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.stun > now) return { input: { x: 0, y: 0, b: 0 } };
    // pick the good object that lands soonest and is reachable
    let target: number | null = null;
    let soonest = Infinity;
    for (const o of s.o) {
      if (o.y > CATCH_Y) continue;
      const tLand = (CATCH_Y - o.y) / Math.max(60, o.vy + 120);
      const reach = Math.abs(o.x - me.x) / SPEED;
      if (o.k === 'bomb') {
        if (Math.abs(o.x - me.x) < HALF + 20 && tLand < 0.8) target = me.x + (o.x > me.x ? -150 : 150);
        continue;
      }
      if (reach < tLand + 0.15 && tLand < soonest) {
        soonest = tLand;
        target = o.x;
      }
    }
    if (target == null) return { input: { x: 0, y: 0, b: 0 } };
    const d = target - me.x;
    const skill = ctx.diff(0.6, 0.8, 1);
    return { input: { x: Math.abs(d) < 12 ? 0 : Math.max(-1, Math.min(1, (d / 80) * skill)), y: 0, b: 0 } };
  },
  results(s, ctx) {
    const best = Math.max(15, ...Object.values(s.p).map((p) => p.score));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      perfs[id] = { score: p.score, perf: Math.max(0, p.score) / best, participated: ctx.acted(id), bonuses: p.bombs === 0 && p.caught > 5 ? [{ label: 'Bomb-free basket', pts: 30 }] : [], highlight: `${p.caught} caught · ${p.bombs} bombs` };
    }
    return { perfs };
  },
});

function spawn(s: S, ctx: GameCtx, frac: number) {
  const r = ctx.rng.next();
  const bombChance = 0.12 + frac * 0.1;
  const k: Kind = r < bombChance ? 'bomb' : r < bombChance + 0.06 ? 'gold' : r < bombChance + 0.22 ? 'cherry' : ctx.rng.chance(0.5) ? 'apple' : 'banana';
  s.o.push({ id: ++s.seq, x: 40 + ctx.rng.next() * (W - 80), y: -30, vy: 90 + ctx.rng.next() * 120 + frac * 90, k });
}
