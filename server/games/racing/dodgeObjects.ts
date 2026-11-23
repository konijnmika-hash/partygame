// Dodge the Objects: meteors land where shadows grow, laser walls sweep across the arena with a
// single safe gap. Three hits and you are out; survive the longest.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { clampRect, collide, integrate, makeBody, r1, steer, type Body } from '../../engine/arena';

export const DO = { W: 1000, H: 700, R: 26, METEOR_R: 72, WARN: 1100, GAP: 130 } as const;
const CAP_MS = 60_000;
const SHIELD_MS = 1300;

interface P {
  b: Body;
  lives: number;
  shield: number;
  out: boolean;
  outAt: number;
  place: number;
  hits: number;
}

interface Meteor { id: number; x: number; y: number; at: number }
/** a sweeping laser: vertical lasers move along x, horizontal along y; gap is centred at g */
interface Laser { id: number; v: boolean; from: number; to: number; start: number; dur: number; g: number }

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  meteors: Meteor[];
  lasers: Laser[];
  seq: number;
  nextMeteor: number;
  nextLaser: number;
  outCount: number;
  fx: { k: 'boom' | 'hit'; x: number; y: number; at: number }[];
}

export function laserPos(l: Laser, now: number): number | null {
  const k = (now - l.start) / l.dur;
  if (k < 0 || k > 1) return null;
  return l.from + (l.to - l.from) * k;
}

export const dodgeObjects = defineGame<S>({
  id: 'dodge-objects',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, DO.W / 2 + Math.cos(a) * 220, DO.H / 2 + Math.sin(a) * 160, DO.R), lives: 3, shield: 0, out: false, outAt: 0, place: 0, hits: 0 };
    });
    return { t0: 0, endsAt: 0, p, inputs: {}, meteors: [], lasers: [], seq: 0, nextMeteor: 0, nextLaser: 0, outCount: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1500;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    s.nextMeteor = s.t0 + 500;
    s.nextLaser = s.t0 + 6000;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return finish(s, ctx);
    const frac = Math.min(1, (now - s.t0) / ctx.ms(CAP_MS));
    const alive = ctx.ids.filter((id) => !s.p[id].out);
    // spawn hazards
    if (now >= s.nextMeteor) {
      const burst = 1 + (frac > 0.5 && ctx.rng.chance(0.4) ? 1 : 0) + (frac > 0.8 && ctx.rng.chance(0.4) ? 1 : 0);
      for (let i = 0; i < burst; i++) {
        let x = 60 + ctx.rng.next() * (DO.W - 120);
        let y = 60 + ctx.rng.next() * (DO.H - 120);
        // sometimes aim at a player
        if (alive.length && ctx.rng.chance(0.5)) {
          const t = s.p[ctx.rng.pick(alive)].b;
          x = Math.max(40, Math.min(DO.W - 40, t.x + (ctx.rng.next() - 0.5) * 80));
          y = Math.max(40, Math.min(DO.H - 40, t.y + (ctx.rng.next() - 0.5) * 80));
        }
        s.meteors.push({ id: ++s.seq, x: r1(x), y: r1(y), at: now + ctx.diff(1300, 1100, 950) });
      }
      s.nextMeteor = now + ctx.diff(1100, 850, 650) * (1 - frac * 0.45);
    }
    if (now >= s.nextLaser) {
      const v = ctx.rng.chance(0.5);
      const span = v ? DO.W : DO.H;
      const fwd = ctx.rng.chance(0.5);
      const other = v ? DO.H : DO.W;
      s.lasers.push({ id: ++s.seq, v, from: fwd ? -20 : span + 20, to: fwd ? span + 20 : -20, start: now + 900, dur: ctx.diff(4200, 3500, 2900) * (1 - frac * 0.25), g: Math.round(DO.GAP + ctx.rng.next() * (other - DO.GAP * 2)) });
      s.nextLaser = now + ctx.diff(7500, 6000, 4800) * (1 - frac * 0.3);
    }
    for (const id of alive) steer(s.p[id].b, s.inputs[id], dt, 1600, 320, 3.6);
    collide(alive.map((id) => s.p[id].b), 0.9);
    for (const id of alive) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, DO.W, DO.H, 0.5);
    }
    // meteor impacts
    for (const m of s.meteors) {
      if (m.at > now) continue;
      s.fx.push({ k: 'boom', x: m.x, y: m.y, at: now });
      for (const id of alive) {
        const b = s.p[id].b;
        if (Math.hypot(b.x - m.x, b.y - m.y) < DO.METEOR_R + b.r * 0.6) hit(s, ctx, id);
      }
    }
    s.meteors = s.meteors.filter((m) => m.at > now);
    // lasers
    for (const l of s.lasers) {
      const pos = laserPos(l, now);
      if (pos == null) continue;
      for (const id of alive) {
        const b = s.p[id].b;
        const along = l.v ? b.y : b.x;
        const across = l.v ? b.x : b.y;
        if (Math.abs(across - pos) < 12 + b.r * 0.7 && Math.abs(along - l.g) > DO.GAP / 2 - b.r * 0.5) hit(s, ctx, id);
      }
    }
    s.lasers = s.lasers.filter((l) => now < l.start + l.dur);
    s.fx = s.fx.filter((f) => now - f.at < 600);
    const left = ctx.ids.filter((id) => !s.p[id].out);
    if ((ctx.ids.length > 1 && left.length <= 1) || left.length === 0) finish(s, ctx);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), l: pl.lives, sh: pl.shield > now ? 1 : 0, o: pl.out ? 1 : 0 };
      }),
      m: s.meteors.map((m) => ({ id: m.id, x: m.x, y: m.y, k: Math.max(0, Math.min(1, 1 - (m.at - now) / DO.WARN)) })),
      l: s.lasers,
      fx: s.fx,
      left: ctx.ids.filter((id) => !s.p[id].out).length,
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.out || now < s.t0) return { input: { x: 0, y: 0, b: 0 } };
    const b = me.b;
    const skill = ctx.diff(0.45, 0.7, 0.9);
    let fx = 0;
    let fy = 0;
    for (const m of s.meteors) {
      const d = Math.hypot(b.x - m.x, b.y - m.y);
      if (d < DO.METEOR_R + 60 && Math.random() < skill + 0.2) {
        const k = (DO.METEOR_R + 60 - d) / 40;
        fx += ((b.x - m.x) / (d || 1)) * k;
        fy += ((b.y - m.y) / (d || 1)) * k;
      }
    }
    for (const l of s.lasers) {
      const pos = laserPos(l, now + 300) ?? (now < l.start ? l.from : null);
      if (pos == null) continue;
      const across = l.v ? b.x : b.y;
      const dirSign = l.to > l.from ? 1 : -1;
      const ahead = (across - pos) * dirSign;
      if (ahead > -30 && ahead < 320) {
        // get into the gap
        const along = l.v ? b.y : b.x;
        const want = Math.max(-1, Math.min(1, (l.g - along) / 40)) * (0.6 + skill * 0.6);
        if (l.v) fy += want * 2;
        else fx += want * 2;
      }
    }
    // drift toward the middle when idle
    fx += (DO.W / 2 - b.x) / 1500;
    fy += (DO.H / 2 - b.y) / 1500;
    const m = Math.hypot(fx, fy);
    if (m < 0.05) return { input: { x: 0, y: 0, b: 0 } };
    return { input: { x: fx / Math.max(1, m), y: fy / Math.max(1, m), b: 0 } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const n = ctx.ids.length;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const place = pl.place || 1;
      const survived = ((pl.out ? pl.outAt : Math.min(ctx.now(), s.endsAt)) - s.t0) / 1000;
      perfs[id] = {
        score: (n - place) * 1000 + pl.lives * 100 + Math.round(survived),
        perf: Math.min(1, (n > 1 ? (n - place) / (n - 1) : 1) * 0.8 + pl.lives * 0.07),
        participated: ctx.acted(id),
        highlight: pl.out ? `Knocked out after ${survived.toFixed(1)} s` : `Survived with ${pl.lives} ${pl.lives === 1 ? 'life' : 'lives'}`,
        bonuses: !pl.out && pl.hits === 0 ? [{ label: 'Untouchable', pts: 40 }] : [],
      };
    }
    return { perfs };
  },
});

function hit(s: S, ctx: GameCtx, id: string) {
  const now = ctx.now();
  const pl = s.p[id];
  if (pl.out || pl.shield > now) return;
  pl.lives--;
  pl.hits++;
  pl.shield = now + SHIELD_MS;
  s.fx.push({ k: 'hit', x: r1(pl.b.x), y: r1(pl.b.y), at: now });
  ctx.event('hit', { id, lives: pl.lives });
  if (pl.lives <= 0) {
    pl.out = true;
    pl.outAt = now;
    pl.place = ctx.ids.length - s.outCount;
    s.outCount++;
  }
}

function finish(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) if (!s.p[id].out) s.p[id].place = 1;
  ctx.end();
}
