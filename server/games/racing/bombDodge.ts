// Bomb Dodge: hot potato with a ticking bomb. Touch another Bloop to pass it on. When it blows,
// the holder is out and a fresh bomb appears. Last Bloop standing wins.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { clampRect, collide, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const BD = { W: 1000, H: 700, R: 27 } as const;
const CAP_MS = 120_000;
const PASS_BACK_MS = 700;
const NEW_BOMB_MS = 2200;

interface P {
  b: Body;
  out: boolean;
  outAt: number;
  place: number;
  passes: number;
  held: number;
}

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  holder: string | null;
  fuseEnd: number;
  fuseLen: number;
  lastFrom: string | null;
  passAt: number;
  nextBombAt: number;
  outCount: number;
  booms: number;
  fx: { k: 'boom' | 'pass'; x: number; y: number; at: number }[];
}

export const bombDodge = defineGame<S>({
  id: 'bomb-dodge',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, BD.W / 2 + Math.cos(a) * 300, BD.H / 2 + Math.sin(a) * 220, BD.R), out: false, outAt: 0, place: 0, passes: 0, held: 0 };
    });
    return { t0: 0, endsAt: 0, p, inputs: {}, holder: null, fuseEnd: 0, fuseLen: 0, lastFrom: null, passAt: 0, nextBombAt: 0, outCount: 0, booms: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1500;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    s.nextBombAt = s.t0 + 800;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return finish(s, ctx);
    const alive = ctx.ids.filter((id) => !s.p[id].out);
    if (!s.holder && now >= s.nextBombAt && alive.length > 1) {
      s.holder = ctx.rng.pick(alive);
      s.fuseLen = ctx.rng.int(ctx.diff(10_000, 9_000, 7_500), ctx.diff(16_000, 14_000, 12_000));
      s.fuseEnd = now + s.fuseLen;
      s.lastFrom = null;
      ctx.event('bomb', { id: s.holder });
    }
    for (const id of alive) {
      const fast = id === s.holder ? 1.12 : 1;
      steer(s.p[id].b, s.inputs[id], dt, 1600 * fast, 320 * fast, 3.6);
    }
    collide(alive.map((id) => s.p[id].b), 0.85, (a, b) => {
      if (!s.holder || now - s.passAt < 150) return;
      let to: string | null = null;
      if (a.id === s.holder) to = b.id;
      else if (b.id === s.holder) to = a.id;
      if (!to) return;
      if (to === s.lastFrom && now - s.passAt < PASS_BACK_MS) return;
      s.p[s.holder].passes++;
      s.lastFrom = s.holder;
      s.holder = to;
      s.passAt = now;
      s.fx.push({ k: 'pass', x: r1(s.p[to].b.x), y: r1(s.p[to].b.y), at: now });
      ctx.event('pass', { from: s.lastFrom, to });
    });
    for (const id of alive) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, BD.W, BD.H, 0.5);
    }
    if (s.holder) s.p[s.holder].held += dt;
    if (s.holder && now >= s.fuseEnd) explode(s, ctx);
    s.fx = s.fx.filter((f) => now - f.at < 900);
    const left = ctx.ids.filter((id) => !s.p[id].out);
    if (left.length <= 1) finish(s, ctx);
  },
  pub(s, ctx) {
    const now = ctx.now();
    // the exact fuse is secret; players only see how urgent it sounds
    const urgency = s.holder ? Math.min(1, Math.max(0, 1 - (s.fuseEnd - now) / s.fuseLen)) : 0;
    return {
      t0: s.t0,
      holder: s.holder,
      urgency: Math.round(urgency * 20) / 20,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), o: pl.out ? 1 : 0, oa: pl.outAt };
      }),
      fx: s.fx,
      left: ctx.ids.filter((id) => !s.p[id].out).length,
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.out || now < s.t0) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    if (s.holder === pid) {
      // chase the nearest valid target
      let target: P | null = null;
      let bd = Infinity;
      for (const id of ctx.ids) {
        if (id === pid || s.p[id].out) continue;
        if (id === s.lastFrom && now - s.passAt < PASS_BACK_MS) continue;
        const d = dist(me.b, s.p[id].b);
        if (d < bd) {
          bd = d;
          target = s.p[id];
        }
      }
      return { input: target ? seek(me.b, target.b, (1 - skill) * 0.6) : { x: 0, y: 0, b: 0 } };
    }
    if (!s.holder) return { input: seek(me.b, { x: BD.W / 2, y: BD.H / 2 }, 0.8) };
    // flee from the holder, but stay away from walls and corners
    const h = s.p[s.holder].b;
    const d = dist(me.b, h) || 1;
    let fx = ((me.b.x - h.x) / d) * Math.min(2, 260 / d);
    let fy = ((me.b.y - h.y) / d) * Math.min(2, 260 / d);
    fx += (BD.W / 2 - me.b.x) / 380;
    fy += (BD.H / 2 - me.b.y) / 300;
    const m = Math.hypot(fx, fy) || 1;
    const wob = (1 - skill) * 0.6;
    return { input: { x: fx / m + (Math.random() - 0.5) * wob, y: fy / m + (Math.random() - 0.5) * wob, b: 0 } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const n = ctx.ids.length;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const place = pl.place || 1;
      perfs[id] = {
        score: (n - place) * 1000 + pl.passes * 5,
        perf: n > 1 ? (n - place) / (n - 1) : 1,
        participated: ctx.acted(id),
        highlight: `${pl.out ? 'Blown up' : '🏆 Survived'} · passed the bomb ${pl.passes}× · held it ${pl.held.toFixed(1)} s`,
        bonuses: pl.held < 1 && !pl.out ? [{ label: 'Never got burned', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});

function explode(s: S, ctx: GameCtx) {
  const now = ctx.now();
  const id = s.holder!;
  const pl = s.p[id];
  pl.out = true;
  pl.outAt = now;
  pl.place = ctx.ids.length - s.outCount;
  s.outCount++;
  s.booms++;
  s.fx.push({ k: 'boom', x: r1(pl.b.x), y: r1(pl.b.y), at: now });
  // knock nearby Bloops away
  for (const oid of ctx.ids) {
    if (oid === id || s.p[oid].out) continue;
    const b = s.p[oid].b;
    const d = Math.hypot(b.x - pl.b.x, b.y - pl.b.y) || 1;
    if (d < 220) {
      b.vx += ((b.x - pl.b.x) / d) * (700 * (1 - d / 220));
      b.vy += ((b.y - pl.b.y) / d) * (700 * (1 - d / 220));
    }
  }
  ctx.event('boom', { id });
  s.holder = null;
  s.nextBombAt = now + NEW_BOMB_MS;
}

function finish(s: S, ctx: GameCtx) {
  for (const id of ctx.ids) if (!s.p[id].out) s.p[id].place = 1;
  ctx.end();
}
