// Survival Run: the lava wall chases everyone through a canyon of rocks, gap walls and rolling
// boulders. Fall behind the lava and you are toast. Survive the longest.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { LR, lavaX, makeLavaCourse, type LavaCourse } from '@shared/lavaRun';
import { collide, integrate, makeBody, r1, steer, type Body } from '../../engine/arena';

const CAP_MS = 75_000;

interface P {
  b: Body;
  out: boolean;
  outAt: number;
  place: number;
  best: number;
  bumps: number;
}

interface Boulder { id: number; x: number; y: number; vx: number; r: number }

interface S {
  seed: number;
  course: LavaCourse;
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  boulders: Boulder[];
  laneNext: number[];
  seq: number;
  outCount: number;
  fx: { k: 'burn' | 'bonk'; x: number; y: number; at: number }[];
}

export const survivalRun = defineGame<S>({
  id: 'survival-run',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const seed = ctx.rng.int(1, 2_000_000_000);
    const course = makeLavaCourse(seed, ctx.difficulty);
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      p[id] = { b: makeBody(id, LR.START_X + (i % 2) * 50, 80 + ((i + 0.5) / n) * (LR.H - 160), LR.R), out: false, outAt: 0, place: 0, best: 0, bumps: 0 };
    });
    return { seed, course, t0: 0, endsAt: 0, p, inputs: {}, boulders: [], laneNext: course.lanes.map(() => 0), seq: 0, outCount: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 2000;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    ctx.asset('lava:course', { seed: s.seed, diff: ctx.difficulty });
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return finish(s, ctx);
    const ms = now - s.t0;
    const lava = lavaX(s.course, ms);
    const alive = ctx.ids.filter((id) => !s.p[id].out);
    // boulders appear in lanes ahead of the lava and roll toward it
    const front = Math.max(...alive.map((id) => s.p[id].b.x), lava);
    s.course.lanes.forEach((ln, i) => {
      if (ln.x < lava + 300 || ln.x > front + 900) return;
      if (now >= s.laneNext[i]) {
        s.boulders.push({ id: ++s.seq, x: ln.x, y: ln.y + (ctx.rng.next() - 0.5) * 60, vx: -ctx.diff(150, 190, 240), r: 30 });
        s.laneNext[i] = now + ln.every;
      }
    });
    for (const bo of s.boulders) bo.x += bo.vx * dt;
    s.boulders = s.boulders.filter((bo) => bo.x > lava - 60);
    for (const id of alive) steer(s.p[id].b, s.inputs[id], dt, 1700, 320, 3.6);
    collide(alive.map((id) => s.p[id].b), 0.7);
    for (const id of alive) {
      const pl = s.p[id];
      const b = pl.b;
      integrate(b, dt);
      for (const r of s.course.rocks) pushCircle(b, r.x, r.y, r.r, 0, 0.3);
      for (const bo of s.boulders) {
        if (pushCircle(b, bo.x, bo.y, bo.r, bo.vx, 0.9)) {
          pl.bumps++;
          if (s.fx.length < 30) s.fx.push({ k: 'bonk', x: r1(b.x), y: r1(b.y), at: now });
        }
      }
      for (const w of s.course.walls) pushRect(b, w.x0, w.y0, w.x1, w.y1);
      b.y = Math.max(b.r, Math.min(LR.H - b.r, b.y));
      b.x = Math.min(LR.LEN, b.x);
      pl.best = Math.max(pl.best, b.x);
      if (b.x - b.r * 0.4 < lava) {
        pl.out = true;
        pl.outAt = now;
        pl.place = ctx.ids.length - s.outCount;
        s.outCount++;
        s.fx.push({ k: 'burn', x: r1(b.x), y: r1(b.y), at: now });
        ctx.event('burn', { id });
      }
    }
    s.fx = s.fx.filter((f) => now - f.at < 700);
    const left = ctx.ids.filter((id) => !s.p[id].out);
    if ((ctx.ids.length > 1 && left.length <= 1) || left.length === 0) finish(s, ctx);
  },
  pub(s, ctx) {
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), o: pl.out ? 1 : 0, oa: pl.outAt };
      }),
      o: s.boulders.map((bo) => ({ id: bo.id, x: r1(bo.x), y: r1(bo.y), r: bo.r })),
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
    let gx = 1;
    let gy = 0;
    // walls ahead: aim for the nearest gap
    const wallX = s.course.walls.filter((w) => w.x0 > b.x - 10 && w.x0 < b.x + 260).map((w) => w.x0);
    if (wallX.length) {
      const wx = Math.min(...wallX);
      const pieces = s.course.walls.filter((w) => w.x0 === wx).sort((a, c) => a.y0 - c.y0);
      const gaps: number[] = [];
      let y = 0;
      for (const w of pieces) {
        if (w.y0 - y > 60) gaps.push((y + w.y0) / 2);
        y = w.y1;
      }
      if (LR.H - y > 60) gaps.push((y + LR.H) / 2);
      if (gaps.length) {
        const g = gaps.reduce((a, c) => (Math.abs(c - b.y) < Math.abs(a - b.y) ? c : a));
        gy = Math.max(-1, Math.min(1, (g - b.y) / 50));
        gx = Math.abs(g - b.y) < 35 ? 1 : 0.25;
      }
    }
    const repel = (ox: number, oy: number, rad: number, k: number) => {
      const dx = b.x - ox;
      const dy = b.y - oy;
      const d = Math.hypot(dx, dy);
      if (d < rad && d > 0) {
        gx += (dx / d) * ((rad - d) / rad) * k * 0.5;
        gy += (dy / d) * ((rad - d) / rad) * k * 1.4;
      }
    };
    for (const r of s.course.rocks) if (r.x > b.x - 60 && r.x < b.x + 200) repel(r.x, r.y, r.r + 70, skill * 1.6);
    for (const bo of s.boulders) if (bo.x > b.x - 40 && bo.x < b.x + 320) repel(bo.x, bo.y, 110, skill * 2.2);
    const m = Math.hypot(gx, gy) || 1;
    return { input: { x: gx / m, y: gy / m, b: 0 } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const n = ctx.ids.length;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const place = pl.place || 1;
      const survived = ((pl.out ? pl.outAt : Math.min(ctx.now(), s.endsAt)) - s.t0) / 1000;
      perfs[id] = {
        score: (n - place) * 100_000 + Math.round(pl.best),
        perf: Math.min(1, (n > 1 ? (n - place) / (n - 1) : 1) * 0.85 + Math.min(0.15, pl.best / LR.LEN)),
        participated: ctx.acted(id),
        highlight: `${pl.out ? `🔥 Toasted after ${survived.toFixed(1)} s` : '🏆 Outran the lava!'} · ${Math.round(pl.best / 50)} m`,
      };
    }
    return { perfs };
  },
});

function pushCircle(b: Body, x: number, y: number, r: number, ovx: number, e: number): boolean {
  const dx = b.x - x;
  const dy = b.y - y;
  const d = Math.hypot(dx, dy);
  if (d >= b.r + r || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  b.x = x + nx * (b.r + r);
  b.y = y + ny * (b.r + r);
  const vn = (b.vx - ovx) * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
  }
  return true;
}

function pushRect(b: Body, x0: number, y0: number, x1: number, y1: number) {
  const qx = Math.max(x0, Math.min(x1, b.x));
  const qy = Math.max(y0, Math.min(y1, b.y));
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d = Math.hypot(dx, dy);
  if (d >= b.r) return;
  if (d < 0.001) {
    b.x = x0 - b.r;
    b.vx = Math.min(0, b.vx);
    return;
  }
  b.x = qx + (dx / d) * b.r;
  b.y = qy + (dy / d) * b.r;
  const vn = b.vx * (dx / d) + b.vy * (dy / d);
  if (vn < 0) {
    b.vx -= vn * (dx / d);
    b.vy -= vn * (dy / d);
  }
}

function finish(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) if (!s.p[id].out) s.p[id].place = 1;
  ctx.end();
}
