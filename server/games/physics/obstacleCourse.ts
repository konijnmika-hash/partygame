// Tiny Obstacle Course: race up a procedurally generated course full of spinning bars, sliding
// walls, bumpers and gates. Server-authoritative physics; finish order decides.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { OC, makeCourse, sliderAt, spinnerEnds, type Course } from '@shared/obstacleCourse';
import { clampRect, collide, integrate, makeBody, r1, steer, type Body } from '../../engine/arena';

const CAP_MS = 75_000;

interface P {
  b: Body;
  finished: number;
  place: number;
  best: number;
  bonks: number;
  stuckSince: number;
  wander: { x: number; until: number };
  boostAt: number;
  bonkAt: number;
}

interface S {
  seed: number;
  course: Course;
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  places: number;
  fx: { k: 'bonk' | 'boost'; x: number; y: number; at: number }[];
}

export const obstacleCourse = defineGame<S>({
  id: 'obstacle-course',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const seed = ctx.rng.int(1, 2_000_000_000);
    const course = makeCourse(seed, ctx.difficulty);
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const x = 120 + ((i + 0.5) / n) * 760;
      p[id] = { b: makeBody(id, x, OC.START_Y + (i % 2) * 40, OC.R), finished: 0, place: 0, best: OC.START_Y, bonks: 0, stuckSince: 0, wander: { x: 0, until: 0 }, boostAt: 0, bonkAt: 0 };
    });
    return { seed, course, t0: 0, endsAt: 0, p, inputs: {}, places: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1500;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    ctx.asset('oc:course', { seed: s.seed, diff: ctx.difficulty });
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return ctx.end();
    const t = (now - s.t0) / 1000;
    const c = s.course;
    const racing = ctx.ids.filter((id) => !s.p[id].finished);
    for (const id of racing) {
      const pl = s.p[id];
      steer(pl.b, s.inputs[id], dt, 1700, 300, 3.4);
    }
    collide(racing.map((id) => s.p[id].b), 0.8);
    for (const id of racing) {
      const pl = s.p[id];
      const b = pl.b;
      integrate(b, dt);
      let hit = false;
      // bumpers: very bouncy
      for (const bm of c.bumpers) {
        const dx = b.x - bm.x;
        const dy = b.y - bm.y;
        const d = Math.hypot(dx, dy);
        if (d < b.r + bm.r && d > 0) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = bm.x + nx * (b.r + bm.r);
          b.y = bm.y + ny * (b.r + bm.r);
          const vn = b.vx * nx + b.vy * ny;
          const out = Math.max(420, -vn * 1.3);
          b.vx += (out - vn) * nx;
          b.vy += (out - vn) * ny;
          hit = true;
        }
      }
      // spinning bars
      for (const sp of c.spinners) {
        const e = spinnerEnds(sp, t);
        const q = closestOnSeg(b.x, b.y, e.ax, e.ay, e.bx, e.by);
        const dx = b.x - q.x;
        const dy = b.y - q.y;
        const d = Math.hypot(dx, dy);
        if (d < b.r + sp.th && d > 0) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = q.x + nx * (b.r + sp.th);
          b.y = q.y + ny * (b.r + sp.th);
          // bar velocity at the contact point
          const bvx = -sp.speed * (q.y - sp.y);
          const bvy = sp.speed * (q.x - sp.x);
          pushOff(b, nx, ny, bvx, bvy, 0.7, 260);
          hit = true;
        }
      }
      // sliding walls
      for (const sl of c.sliders) {
        const at = sliderAt(sl, t);
        if (rectHit(b, at.x - sl.hw, sl.y - sl.hh, at.x + sl.hw, sl.y + sl.hh, at.vx, 0)) hit = true;
      }
      for (const w of c.walls) rectHit(b, w.x0, w.y0, w.x1, w.y1, 0, 0);
      for (const bo of c.boosters) {
        if (Math.hypot(b.x - bo.x, b.y - bo.y) < bo.r + 8 && now - pl.boostAt > 800) {
          pl.boostAt = now;
          b.vy = Math.min(b.vy, -720);
          s.fx.push({ k: 'boost', x: r1(bo.x), y: r1(bo.y), at: now });
        }
      }
      clampRect(b, 0, 0, OC.W, OC.H, 0.4);
      if (hit && now - pl.bonkAt > 400) {
        pl.bonkAt = now;
        pl.bonks++;
        if (s.fx.length < 30) s.fx.push({ k: 'bonk', x: r1(b.x), y: r1(b.y), at: now });
      }
      if (b.y < pl.best - 4) {
        pl.best = b.y;
        pl.stuckSince = now;
      }
      if (b.y <= OC.FINISH_Y) {
        pl.finished = now - s.t0;
        pl.place = ++s.places;
        b.vx = 0;
        b.vy = 0;
        ctx.event('finish', { id, place: pl.place, ms: pl.finished });
      }
    }
    s.fx = s.fx.filter((f) => now - f.at < 600);
    if (ctx.ids.every((id) => s.p[id].finished || !ctx.isConnected(id))) ctx.end();
  },
  pub(s, ctx) {
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), f: pl.finished, pl: pl.place };
      }),
      fx: s.fx,
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.finished || now < s.t0) return { input: { x: 0, y: 0, b: 0 } };
    const b = me.b;
    const t = (now - s.t0) / 1000;
    // un-stick: wander sideways when no progress
    if (now - me.stuckSince > 1600 && me.wander.until < now) me.wander = { x: Math.random() < 0.5 ? -1 : 1, until: now + 700 };
    if (me.wander.until > now) return { input: { x: me.wander.x, y: -0.3, b: 0 } };
    let gx = 0;
    let gy = -1;
    // gates/walls ahead: steer to the nearest opening
    const ahead = s.course.walls.filter((w) => w.y1 < b.y && w.y1 > b.y - 220);
    if (ahead.length) {
      const wy = ahead[0].y0;
      const row = s.course.walls.filter((w) => w.y0 === wy).sort((a, c) => a.x0 - c.x0);
      const gaps: number[] = [];
      let x = 0;
      for (const w of row) {
        if (w.x0 - x > 60) gaps.push((x + w.x0) / 2);
        x = w.x1;
      }
      if (OC.W - x > 60) gaps.push((x + OC.W) / 2);
      if (gaps.length) {
        const g = gaps.reduce((a, c) => (Math.abs(c - b.x) < Math.abs(a - b.x) ? c : a));
        gx = Math.max(-1, Math.min(1, (g - b.x) / 60));
        gy = Math.abs(g - b.x) < 40 ? -1 : -0.25;
      }
    }
    // repulsion from nearby moving obstacles
    const skill = ctx.diff(0.4, 0.65, 0.85);
    const repel = (ox: number, oy: number, rad: number) => {
      const dx = b.x - ox;
      const dy = b.y - oy;
      const d = Math.hypot(dx, dy);
      if (d < rad && d > 0) {
        const k = ((rad - d) / rad) * 1.6 * skill;
        gx += (dx / d) * k;
        gy += (dy / d) * k * 0.6;
      }
    };
    for (const bm of s.course.bumpers) repel(bm.x, bm.y, bm.r + 70);
    for (const sp of s.course.spinners) {
      const e = spinnerEnds(sp, t + 0.15);
      const q = closestOnSeg(b.x, b.y, e.ax, e.ay, e.bx, e.by);
      repel(q.x, q.y, 90);
    }
    for (const sl of s.course.sliders) {
      const at = sliderAt(sl, t + 0.2);
      const qx = Math.max(at.x - sl.hw, Math.min(at.x + sl.hw, b.x));
      repel(qx, sl.y, 95);
    }
    const m = Math.hypot(gx, gy) || 1;
    return { input: { x: gx / m, y: gy / m, b: 0 } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const total = OC.START_Y - OC.FINISH_Y;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const prog = Math.max(0, Math.min(1, (OC.START_Y - pl.best) / total));
      if (pl.finished) {
        perfs[id] = {
          score: 1_000_000 - pl.finished,
          perf: Math.min(1, 0.6 + 0.4 * Math.min(1, 26_000 / pl.finished)),
          participated: ctx.acted(id),
          highlight: `Finished #${pl.place} in ${(pl.finished / 1000).toFixed(2)} s · ${pl.bonks} bonks`,
          bonuses: pl.place === 1 ? [{ label: 'First across the line', pts: 30 }] : [],
        };
      } else {
        perfs[id] = { score: Math.round(prog * 1000), perf: prog * 0.55, participated: ctx.acted(id), highlight: `Made it ${Math.round(prog * 100)}% of the way` };
      }
    }
    const records = Object.fromEntries(
      ctx.ids.filter((id) => s.p[id].finished).map((id) => [id, [{ key: 'time', label: 'Fastest obstacle course', value: s.p[id].finished, better: 'lower' as const, format: 'ms' as const }]]),
    );
    return { perfs, records };
  },
});

function closestOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return { x: ax + dx * k, y: ay + dy * k };
}

function pushOff(b: Body, nx: number, ny: number, ovx: number, ovy: number, e: number, kick: number) {
  const rvx = b.vx - ovx;
  const rvy = b.vy - ovy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
  }
  b.vx += nx * kick * 0.5;
  b.vy += ny * kick * 0.5;
}

function rectHit(b: Body, x0: number, y0: number, x1: number, y1: number, ovx: number, ovy: number): boolean {
  const qx = Math.max(x0, Math.min(x1, b.x));
  const qy = Math.max(y0, Math.min(y1, b.y));
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= b.r * b.r) return false;
  let nx: number;
  let ny: number;
  let d = Math.sqrt(d2);
  if (d < 0.001) {
    // centre inside the rect: push out along the shallowest axis
    const pen = [b.x - x0, x1 - b.x, b.y - y0, y1 - b.y];
    const m = Math.min(...pen);
    const i = pen.indexOf(m);
    nx = i === 0 ? -1 : i === 1 ? 1 : 0;
    ny = i === 2 ? -1 : i === 3 ? 1 : 0;
    d = -m;
  } else {
    nx = dx / d;
    ny = dy / d;
  }
  b.x += nx * (b.r - d);
  b.y += ny * (b.r - d);
  pushOff(b, nx, ny, ovx, ovy, 0.3, Math.abs(ovx) > 1 ? 160 : 0);
  return Math.abs(ovx) > 1;
}
