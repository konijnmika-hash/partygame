// Balloon Survival: everyone carries three balloons. Darts fly across the arena; dash into
// rivals to pop theirs. Last Bloop with balloons wins.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dash, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const BS = { W: 1000, H: 700, R: 28, HIT: 36 } as const;
const CAP_MS = 75_000;
const DASH_CD = 1800;
const DASH_MS = 240;
const SHIELD_MS = 1600;

interface P {
  b: Body;
  balloons: number;
  shieldUntil: number;
  dashAt: number;
  out: boolean;
  outAt: number;
  place: number;
  pops: number;
}

interface Dart {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  darts: Dart[];
  seq: number;
  nextDart: number;
  outCount: number;
  fx: { k: 'pop'; x: number; y: number; at: number; c: number }[];
}

export const balloonSurvival = defineGame<S>({
  id: 'balloon-survival',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, BS.W / 2 + Math.cos(a) * 280, BS.H / 2 + Math.sin(a) * 190, BS.R), balloons: 3, shieldUntil: 0, dashAt: -99999, out: false, outAt: 0, place: 0, pops: 0 };
    });
    return { t0: 0, endsAt: 0, p, inputs: {}, btn: new Buttons(), darts: [], seq: 0, nextDart: 0, outCount: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1200;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    s.nextDart = s.t0 + 1500;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return finish(s, ctx);
    const frac = Math.min(1, (now - s.t0) / ctx.ms(CAP_MS));
    if (now >= s.nextDart) {
      spawnDart(s, ctx, frac);
      const every = (ctx.diff(1600, 1250, 950) * (1 - frac * 0.5)) / (1 + Math.min(0.6, ctx.ids.length / 12));
      s.nextDart = now + every * (0.6 + ctx.rng.next() * 0.8);
    }
    const alive = ctx.ids.filter((id) => !s.p[id].out);
    for (const id of alive) {
      const pl = s.p[id];
      const f = s.inputs[id];
      steer(pl.b, f, dt, 1500, 310, 3.4);
      if (s.btn.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 600);
      }
    }
    collide(alive.map((id) => s.p[id].b), 0.9, (a, b, impact) => {
      if (impact < 220) return;
      const pa = s.p[a.id];
      const pb = s.p[b.id];
      const aDash = now - pa.dashAt < DASH_MS;
      const bDash = now - pb.dashAt < DASH_MS;
      if (aDash && !bDash) pop(s, ctx, b.id, a.id);
      else if (bDash && !aDash) pop(s, ctx, a.id, b.id);
    });
    for (const id of alive) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      clampRect(pl.b, 0, 0, BS.W, BS.H, 0.5);
    }
    // darts
    for (const d of s.darts) {
      const px = d.x;
      const py = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      for (const id of alive) {
        const pl = s.p[id];
        if (pl.out) continue;
        if (segDist(pl.b.x, pl.b.y, px, py, d.x, d.y) < BS.HIT) {
          if (pop(s, ctx, id, null)) d.x = -9999;
        }
      }
    }
    s.darts = s.darts.filter((d) => d.x > -80 && d.x < BS.W + 80 && d.y > -80 && d.y < BS.H + 80);
    s.fx = s.fx.filter((f) => now - f.at < 700);
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
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), n: pl.balloons, sh: pl.shieldUntil > now ? 1 : 0, d: now - pl.dashAt < DASH_MS ? 1 : 0, o: pl.out ? 1 : 0, cd: Math.max(0, Math.round(DASH_CD - (now - pl.dashAt))) };
      }),
      o: s.darts.map((d) => ({ id: d.id, x: r1(d.x), y: r1(d.y), a: Math.round(Math.atan2(d.vy, d.vx) * 100) / 100 })),
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
    // dodge: darts whose path passes close within the next 0.9 s
    let fx = 0;
    let fy = 0;
    for (const d of s.darts) {
      const sp = Math.hypot(d.vx, d.vy) || 1;
      const tx = d.vx / sp;
      const ty = d.vy / sp;
      const rx = b.x - d.x;
      const ry = b.y - d.y;
      const along = rx * tx + ry * ty;
      if (along < -20 || along > sp * 0.9) continue;
      const perp = rx * -ty + ry * tx;
      if (Math.abs(perp) < 75 && Math.random() < skill + 0.15) {
        const side = perp >= 0 ? 1 : -1;
        fx += -ty * side * 2;
        fy += tx * side * 2;
      }
    }
    if (fx || fy) {
      const m = Math.hypot(fx, fy);
      return { input: { x: fx / m, y: fy / m, b: 0 } };
    }
    // only some bots are in a hunting mood at any moment; the rest roam and keep their distance
    const hunting = (Math.floor(now / 4000) + pid.length) % 3 !== 0 && me.balloons >= 2;
    // hunt the nearest rival
    let target: P | null = null;
    let bd = Infinity;
    for (const id of ctx.ids) {
      if (id === pid || s.p[id].out) continue;
      const d = dist(b, s.p[id].b);
      if (d < bd) {
        bd = d;
        target = s.p[id];
      }
    }
    if (!target) return { input: { x: 0, y: 0, b: 0 } };
    if (!hunting) {
      const away = seek(target.b, b, 0.6);
      const cx = BS.W / 2 - b.x;
      const cy = BS.H / 2 - b.y;
      const m = Math.hypot(away.x + cx / 400, away.y + cy / 300) || 1;
      return { input: { x: (away.x + cx / 400) / m, y: (away.y + cy / 300) / m, b: 0 } };
    }
    const inp = seek(b, target.b, 0.3);
    if (bd < ctx.diff(110, 140, 170) && now - me.dashAt > DASH_CD && target.shieldUntil < now && Math.random() < skill * 0.6) inp.b = 1;
    // keep some distance when the dash is cooling down
    if (now - me.dashAt < DASH_CD && bd < 160) {
      inp.x = -inp.x;
      inp.y = -inp.y;
    }
    return { input: inp };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const n = ctx.ids.length;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const place = pl.place || 1;
      perfs[id] = {
        score: (n - place) * 1000 + pl.balloons * 100 + pl.pops * 10,
        perf: Math.min(1, (n > 1 ? (n - place) / (n - 1) : 1) * 0.8 + Math.min(0.2, pl.pops * 0.05)),
        participated: ctx.acted(id),
        highlight: `${pl.out ? 'Out of balloons' : `🎈×${pl.balloons} left`} · popped ${pl.pops} rival balloon${pl.pops === 1 ? '' : 's'}`,
        bonuses: !pl.out && pl.balloons === 3 ? [{ label: 'Untouched', pts: 40 }] : [],
      };
    }
    return { perfs };
  },
});

function pop(s: S, ctx: GameCtx, victim: string, by: string | null): boolean {
  const now = ctx.now();
  const pl = s.p[victim];
  if (pl.out || pl.shieldUntil > now) return false;
  pl.balloons--;
  pl.shieldUntil = now + SHIELD_MS;
  s.fx.push({ k: 'pop', x: r1(pl.b.x), y: r1(pl.b.y - 50), at: now, c: pl.balloons });
  if (by) s.p[by].pops++;
  ctx.event('pop', { id: victim, by });
  if (pl.balloons <= 0) {
    pl.out = true;
    pl.outAt = now;
    pl.place = ctx.ids.length - s.outCount;
    s.outCount++;
  }
  return true;
}

function spawnDart(s: S, ctx: GameCtx, frac: number) {
  const side = ctx.rng.int(0, 3);
  const speed = ctx.diff(330, 400, 480) * (1 + frac * 0.4) * (0.85 + ctx.rng.next() * 0.3);
  let x: number;
  let y: number;
  if (side === 0) [x, y] = [-30, 60 + ctx.rng.next() * (BS.H - 120)];
  else if (side === 1) [x, y] = [BS.W + 30, 60 + ctx.rng.next() * (BS.H - 120)];
  else if (side === 2) [x, y] = [60 + ctx.rng.next() * (BS.W - 120), -30];
  else [x, y] = [60 + ctx.rng.next() * (BS.W - 120), BS.H + 30];
  // aim at a random living player sometimes, otherwise across the arena
  const alive = ctx.ids.filter((id) => !s.p[id].out);
  let tx = BS.W / 2 + (ctx.rng.next() - 0.5) * 500;
  let ty = BS.H / 2 + (ctx.rng.next() - 0.5) * 300;
  if (alive.length && ctx.rng.chance(0.45)) {
    const t = s.p[ctx.rng.pick(alive)].b;
    tx = t.x;
    ty = t.y;
  }
  const d = Math.hypot(tx - x, ty - y) || 1;
  s.darts.push({ id: ++s.seq, x, y, vx: ((tx - x) / d) * speed, vy: ((ty - y) / d) * speed });
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}

function finish(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) if (!s.p[id].out) s.p[id].place = 1;
  ctx.end();
}
