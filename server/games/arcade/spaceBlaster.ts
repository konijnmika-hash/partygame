// Space Blaster: drift around a wrap-around asteroid field. Your ship faces where you thrust and
// fires automatically. Big asteroids split into smaller ones; ramming a rock stuns you.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { r1 } from '../../engine/arena';

export const SP = { W: 1200, H: 800, R: 20 } as const;
const DURATION = 65_000;
const FIRE_MS = 280;
const STUN_MS = 1400;
const SIZES = [0, 18, 32, 50];
const POINTS = [0, 100, 50, 20];

interface Ship { x: number; y: number; vx: number; vy: number; a: number; fireAt: number; stunUntil: number; score: number; kills: number; crashes: number }
interface Rock { id: number; x: number; y: number; vx: number; vy: number; size: number; spin: number }
interface Shot { id: number; owner: string; x: number; y: number; vx: number; vy: number; life: number }

interface S {
  endsAt: number;
  ships: Record<string, Ship>;
  inputs: Record<string, InputFrame>;
  rocks: Rock[];
  shots: Shot[];
  seq: number;
  fx: { x: number; y: number; at: number; s: number }[];
}

function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}

/** Shortest wrapped delta from a to b. */
function wd(a: number, b: number, max: number): number {
  let d = b - a;
  if (d > max / 2) d -= max;
  if (d < -max / 2) d += max;
  return d;
}

export const spaceBlaster = defineGame<S>({
  id: 'space-blaster',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const ships: Record<string, Ship> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      ships[id] = { x: SP.W / 2 + Math.cos(a) * 180, y: SP.H / 2 + Math.sin(a) * 140, vx: 0, vy: 0, a, fireAt: 0, stunUntil: 0, score: 0, kills: 0, crashes: 0 };
    });
    const s: S = { endsAt: 0, ships, inputs: {}, rocks: [], shots: [], seq: 0, fx: [] };
    for (let i = 0; i < 5 + Math.ceil(n / 2); i++) spawnRock(s, ctx, 3);
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
      const sh = s.ships[id];
      const f = sh.stunUntil > now ? undefined : s.inputs[id];
      const mag = f ? Math.hypot(f.x, f.y) : 0;
      if (f && mag > 0.25) {
        sh.a = Math.atan2(f.y, f.x);
        sh.vx += (f.x / Math.max(1, mag)) * 620 * dt;
        sh.vy += (f.y / Math.max(1, mag)) * 620 * dt;
      }
      sh.vx *= Math.max(0, 1 - 0.7 * dt);
      sh.vy *= Math.max(0, 1 - 0.7 * dt);
      const sp = Math.hypot(sh.vx, sh.vy);
      if (sp > 360) {
        sh.vx *= 360 / sp;
        sh.vy *= 360 / sp;
      }
      sh.x = wrap(sh.x + sh.vx * dt, SP.W);
      sh.y = wrap(sh.y + sh.vy * dt, SP.H);
      if (sh.stunUntil <= now && now - sh.fireAt >= FIRE_MS) {
        sh.fireAt = now;
        s.shots.push({ id: ++s.seq, owner: id, x: sh.x + Math.cos(sh.a) * 24, y: sh.y + Math.sin(sh.a) * 24, vx: Math.cos(sh.a) * 720 + sh.vx * 0.3, vy: Math.sin(sh.a) * 720 + sh.vy * 0.3, life: 0.9 });
      }
    }
    for (const r of s.rocks) {
      r.x = wrap(r.x + r.vx * dt, SP.W);
      r.y = wrap(r.y + r.vy * dt, SP.H);
    }
    for (const sh of s.shots) {
      sh.x = wrap(sh.x + sh.vx * dt, SP.W);
      sh.y = wrap(sh.y + sh.vy * dt, SP.H);
      sh.life -= dt;
    }
    // shots vs rocks
    const born: Rock[] = [];
    for (const shot of s.shots) {
      if (shot.life <= 0) continue;
      for (const r of s.rocks) {
        if (r.size <= 0) continue;
        if (Math.hypot(wd(shot.x, r.x, SP.W), wd(shot.y, r.y, SP.H)) < SIZES[r.size]) {
          shot.life = 0;
          const ship = s.ships[shot.owner];
          ship.score += POINTS[r.size];
          ship.kills++;
          s.fx.push({ x: r1(r.x), y: r1(r.y), at: now, s: r.size });
          if (r.size > 1) {
            for (let k = 0; k < 2; k++) {
              const a = ctx.rng.next() * Math.PI * 2;
              const v = 60 + ctx.rng.next() * 90 + (3 - r.size) * 40;
              born.push({ id: ++s.seq, x: r.x, y: r.y, vx: r.vx * 0.5 + Math.cos(a) * v, vy: r.vy * 0.5 + Math.sin(a) * v, size: r.size - 1, spin: ctx.rng.next() * 2 - 1 });
            }
          }
          r.size = 0;
          break;
        }
      }
    }
    s.rocks = s.rocks.filter((r) => r.size > 0).concat(born);
    s.shots = s.shots.filter((sh) => sh.life > 0);
    // ships vs rocks: a crash stuns and bounces you
    for (const id of ctx.ids) {
      const sh = s.ships[id];
      if (sh.stunUntil > now) continue;
      for (const r of s.rocks) {
        const dx = wd(r.x, sh.x, SP.W);
        const dy = wd(r.y, sh.y, SP.H);
        const d = Math.hypot(dx, dy);
        if (d < SIZES[r.size] + SP.R - 4) {
          sh.stunUntil = now + STUN_MS;
          sh.crashes++;
          sh.vx = (dx / (d || 1)) * 260;
          sh.vy = (dy / (d || 1)) * 260;
          ctx.event('crash', { id });
          break;
        }
      }
    }
    // keep the field busy
    while (s.rocks.reduce((a, r) => a + r.size, 0) < 10 + ctx.ids.length * 2) spawnRock(s, ctx, 3);
    s.fx = s.fx.filter((f) => now - f.at < 600);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const sh = s.ships[id];
        return { id, x: r1(sh.x), y: r1(sh.y), a: Math.round(sh.a * 100) / 100, st: sh.stunUntil > now ? 1 : 0 };
      }),
      o: s.rocks.map((r) => ({ id: r.id, x: r1(r.x), y: r1(r.y), s: r.size, a: Math.round(((now / 1000) * r.spin) * 100) / 100 })),
      shots: s.shots.map((sh) => [r1(sh.x), r1(sh.y)]),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.ships[id].score])),
    };
  },
  bot(s, ctx, pid) {
    const sh = s.ships[pid];
    if (sh.stunUntil > ctx.now()) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    let best: Rock | null = null;
    let bs = -Infinity;
    let fx = 0;
    let fy = 0;
    for (const r of s.rocks) {
      const dx = wd(sh.x, r.x, SP.W);
      const dy = wd(sh.y, r.y, SP.H);
      const d = Math.hypot(dx, dy);
      // don't fly into rocks
      if (d < SIZES[r.size] + 90) {
        fx -= (dx / (d || 1)) * 1.5 * skill;
        fy -= (dy / (d || 1)) * 1.5 * skill;
      }
      const sc = POINTS[r.size] / 40 - d / 200;
      if (sc > bs) {
        bs = sc;
        best = r;
      }
    }
    if (best) {
      const dx = wd(sh.x, best.x, SP.W);
      const dy = wd(sh.y, best.y, SP.H);
      const d = Math.hypot(dx, dy) || 1;
      // point at the rock; only thrust toward it when it's far
      const push = d > 260 ? 1 : 0.35;
      fx += (dx / d) * push;
      fy += (dy / d) * push;
    }
    const m = Math.hypot(fx, fy) || 1;
    return { input: { x: fx / m + (Math.random() - 0.5) * (1 - skill) * 0.4, y: fy / m + (Math.random() - 0.5) * (1 - skill) * 0.4, b: 0 } };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => s.ships[id].score));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const sh = s.ships[id];
      perfs[id] = {
        score: sh.score,
        perf: Math.min(1, sh.score / best),
        participated: ctx.acted(id),
        highlight: `${sh.score} pts · ${sh.kills} rock${sh.kills === 1 ? '' : 's'} blasted · ${sh.crashes} crash${sh.crashes === 1 ? '' : 'es'}`,
        bonuses: sh.crashes === 0 && sh.kills > 5 ? [{ label: 'Ace pilot', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});

function spawnRock(s: S, ctx: GameCtx, size: number) {
  // spawn at the edges, away from the ships
  const edge = ctx.rng.int(0, 3);
  const x = edge === 0 ? 0 : edge === 1 ? SP.W - 1 : ctx.rng.next() * SP.W;
  const y = edge === 2 ? 0 : edge === 3 ? SP.H - 1 : ctx.rng.next() * SP.H;
  const a = ctx.rng.next() * Math.PI * 2;
  const v = 40 + ctx.rng.next() * 60;
  s.rocks.push({ id: ++s.seq, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size, spin: ctx.rng.next() * 2 - 1 });
}
