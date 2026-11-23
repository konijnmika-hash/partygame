// Hungry Blobs: eat pellets to grow; bigger Bloops swallow smaller ones (and move slower).
// Get eaten and you respawn small. Biggest mass at the end wins.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { r1 } from '../../engine/arena';

export const HB = { W: 1600, H: 1100, START: 20 } as const;
const DURATION = 70_000;
const PELLETS = 140;

export function radiusOf(mass: number): number {
  return Math.sqrt(mass) * 5.4;
}

interface Blob { x: number; y: number; vx: number; vy: number; mass: number; peak: number; eaten: number; ate: number; spawnAt: number }
interface Pellet { id: number; x: number; y: number }

interface S {
  endsAt: number;
  b: Record<string, Blob>;
  inputs: Record<string, InputFrame>;
  pellets: Pellet[];
  seq: number;
}

export const hungryBlobs = defineGame<S>({
  id: 'hungry-blobs',
  realtime: true,
  pubEvery: 2,
  botDelay: [100, 170],
  setup(ctx) {
    const b: Record<string, Blob> = {};
    for (const id of ctx.ids) b[id] = { ...spawnPos(ctx), vx: 0, vy: 0, mass: HB.START, peak: HB.START, eaten: 0, ate: 0, spawnAt: 0 };
    const s: S = { endsAt: 0, b, inputs: {}, pellets: [], seq: 0 };
    while (s.pellets.length < PELLETS) s.pellets.push({ id: ++s.seq, x: Math.round(20 + ctx.rng.next() * (HB.W - 40)), y: Math.round(20 + ctx.rng.next() * (HB.H - 40)) });
    return s;
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    for (const id of ctx.ids) {
      const bl = s.b[id];
      const f = s.inputs[id];
      // bigger blobs are slower
      const vmax = 320 * Math.pow(HB.START / bl.mass, 0.32);
      const tx = (f?.x ?? 0) * vmax;
      const ty = (f?.y ?? 0) * vmax;
      bl.vx += (tx - bl.vx) * Math.min(1, dt * 6);
      bl.vy += (ty - bl.vy) * Math.min(1, dt * 6);
      const r = radiusOf(bl.mass);
      bl.x = Math.max(r * 0.5, Math.min(HB.W - r * 0.5, bl.x + bl.vx * dt));
      bl.y = Math.max(r * 0.5, Math.min(HB.H - r * 0.5, bl.y + bl.vy * dt));
      // pellets
      for (const p of s.pellets) {
        if (p.x < 0) continue;
        if ((p.x - bl.x) ** 2 + (p.y - bl.y) ** 2 < r * r) {
          bl.mass += 1;
          p.x = -1;
        }
      }
      // slow mass decay keeps the giants hungry
      if (bl.mass > 60) bl.mass -= bl.mass * 0.004 * dt;
      bl.peak = Math.max(bl.peak, bl.mass);
    }
    s.pellets = s.pellets.filter((p) => p.x >= 0);
    while (s.pellets.length < PELLETS) s.pellets.push({ id: ++s.seq, x: Math.round(20 + ctx.rng.next() * (HB.W - 40)), y: Math.round(20 + ctx.rng.next() * (HB.H - 40)) });
    // blobs eat blobs at least 20% smaller when the centre is covered
    for (const a of ctx.ids) {
      for (const b of ctx.ids) {
        if (a === b) continue;
        const A = s.b[a];
        const B = s.b[b];
        if (A.mass < B.mass * 1.2 || now - B.spawnAt < 2000) continue;
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < radiusOf(A.mass) - radiusOf(B.mass) * 0.4) {
          A.mass += B.mass * 0.8;
          A.ate++;
          B.eaten++;
          ctx.event('gulp', { by: a, id: b });
          Object.assign(B, spawnPos(ctx), { vx: 0, vy: 0, mass: HB.START, spawnAt: now });
        }
      }
    }
  },
  pub(s, ctx) {
    return {
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => ({ id, x: r1(s.b[id].x), y: r1(s.b[id].y), m: Math.round(s.b[id].mass * 10) / 10 })),
      pel: s.pellets.map((p) => [p.x, p.y]),
      scores: Object.fromEntries(ctx.ids.map((id) => [id, Math.round(s.b[id].mass)])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.b[pid];
    const skill = ctx.diff(0.45, 0.7, 0.9);

    let fx = 0;
    let fy = 0;
    for (const id of ctx.ids) {
      if (id === pid) continue;
      const o = s.b[id];
      const dx = o.x - me.x;
      const dy = o.y - me.y;
      const d = Math.hypot(dx, dy) || 1;
      if (o.mass > me.mass * 1.2 && d < 320) {
        // flee from bigger blobs
        fx -= (dx / d) * (320 - d) / 60 * skill;
        fy -= (dy / d) * (320 - d) / 60 * skill;
      } else if (me.mass > o.mass * 1.25 && d < 380) {
        fx += (dx / d) * 2.5;
        fy += (dy / d) * 2.5;
      }
    }
    // nearest pellet cluster
    let best: Pellet | null = null;
    let bd = Infinity;
    for (const p of s.pellets) {
      const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) {
      const d = Math.sqrt(bd) || 1;
      fx += ((best.x - me.x) / d) * 1;
      fy += ((best.y - me.y) / d) * 1;
    }
    fx += (HB.W / 2 - me.x) / 4000;
    fy += (HB.H / 2 - me.y) / 4000;
    const m = Math.hypot(fx, fy) || 1;
    return { input: { x: fx / m, y: fy / m, b: 0 } };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => s.b[id].mass));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const bl = s.b[id];
      perfs[id] = {
        score: Math.round(bl.mass),
        perf: Math.min(1, bl.mass / best),
        participated: ctx.acted(id),
        highlight: `Final mass ${Math.round(bl.mass)} (peak ${Math.round(bl.peak)}) · gobbled ${bl.ate} · eaten ${bl.eaten}×`,
        bonuses: bl.eaten === 0 && bl.ate > 0 ? [{ label: 'Apex blob', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});

function spawnPos(ctx: GameCtx): { x: number; y: number } {
  return { x: Math.round(100 + ctx.rng.next() * (HB.W - 200)), y: Math.round(100 + ctx.rng.next() * (HB.H - 200)) };
}
