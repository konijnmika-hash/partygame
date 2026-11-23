// Crown Chase: grab the crown and keep it. You score every second you wear it; dash into the
// wearer to knock it loose. Most crown time wins.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dash, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const CR = { W: 1000, H: 700, R: 26 } as const;
const DURATION = 60_000;
const DASH_CD = 1300;
const DASH_MS = 240;
const GRACE_MS = 900;

interface P { b: Body; dashAt: number; held: number; steals: number }

interface S {
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  holder: string | null;
  crown: { x: number; y: number; vx: number; vy: number };
  grabAt: number;
  noGrab: Record<string, number>;
}

export const crownChase = defineGame<S>({
  id: 'crown-chase',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, CR.W / 2 + Math.cos(a) * 300, CR.H / 2 + Math.sin(a) * 230, CR.R), dashAt: -99999, held: 0, steals: 0 };
    });
    return { endsAt: 0, p, inputs: {}, btn: new Buttons(), holder: null, crown: { x: CR.W / 2, y: CR.H / 2, vx: 0, vy: 0 }, grabAt: 0, noGrab: {} };
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
      const pl = s.p[id];
      const f = s.inputs[id];
      const wearing = s.holder === id;
      steer(pl.b, f, dt, 1500, wearing ? 285 : 320, 3.5);
      if (s.btn.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 600);
      }
      pl.b.m = now - pl.dashAt < DASH_MS ? 2.2 : 1;
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.9, (a, b, impact) => {
      if (!s.holder || impact < 180 || now - s.grabAt < GRACE_MS) return;
      const other = a.id === s.holder ? b.id : b.id === s.holder ? a.id : null;
      if (!other || now - s.p[other].dashAt > DASH_MS) return;
      knockLoose(s, ctx, other);
    });
    for (const id of ctx.ids) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, CR.W, CR.H, 0.5);
    }
    if (s.holder) {
      const h = s.p[s.holder];
      h.held += dt;
      s.crown.x = h.b.x;
      s.crown.y = h.b.y - 40;
    } else {
      // a loose crown skids to a stop, then anyone can grab it
      s.crown.x = Math.max(20, Math.min(CR.W - 20, s.crown.x + s.crown.vx * dt));
      s.crown.y = Math.max(20, Math.min(CR.H - 20, s.crown.y + s.crown.vy * dt));
      s.crown.vx *= Math.max(0, 1 - 3 * dt);
      s.crown.vy *= Math.max(0, 1 - 3 * dt);
      for (const id of ctx.ids) {
        if ((s.noGrab[id] ?? 0) > now) continue;
        if (dist(s.p[id].b, s.crown) < CR.R + 22) {
          s.holder = id;
          s.grabAt = now;
          ctx.event('grab', { id });
          break;
        }
      }
    }
  },
  pub(s, ctx) {
    return {
      endsAt: s.endsAt,
      holder: s.holder,
      crown: { x: r1(s.crown.x), y: r1(s.crown.y) },
      p: ctx.ids.map((id) => ({ id, x: r1(s.p[id].b.x), y: r1(s.p[id].b.y), d: ctx.now() - s.p[id].dashAt < DASH_MS ? 1 : 0 })),
      scores: Object.fromEntries(ctx.ids.map((id) => [id, Math.round(s.p[id].held * 10) / 10])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    const skill = ctx.diff(0.45, 0.7, 0.9);
    if (s.holder === pid) {
      // run away from the closest chaser, staying off the walls
      let fx = (CR.W / 2 - me.b.x) / 600;
      let fy = (CR.H / 2 - me.b.y) / 450;
      for (const id of ctx.ids) {
        if (id === pid) continue;
        const o = s.p[id].b;
        const d = dist(me.b, o) || 1;
        if (d < 260) {
          fx += ((me.b.x - o.x) / d) * (260 - d) / 120;
          fy += ((me.b.y - o.y) / d) * (260 - d) / 120;
        }
      }
      const m = Math.hypot(fx, fy) || 1;
      return { input: { x: fx / m, y: fy / m, b: 0 } };
    }
    const target = s.holder ? s.p[s.holder].b : s.crown;
    const inp = seek(me.b, target, (1 - skill) * 0.5);
    if (s.holder && dist(me.b, target) < ctx.diff(110, 140, 170) && now - me.dashAt > DASH_CD && Math.random() < skill * 0.7) inp.b = 1;
    return { input: inp };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => s.p[id].held));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = {
        score: Math.round(s.p[id].held * 10),
        perf: Math.min(1, s.p[id].held / best),
        participated: ctx.acted(id),
        highlight: `👑 ${s.p[id].held.toFixed(1)} s wearing the crown · ${s.p[id].steals} steal${s.p[id].steals === 1 ? '' : 's'}`,
      };
    }
    return { perfs };
  },
});

function knockLoose(s: S, ctx: GameCtx, by: string) {
  const h = s.p[s.holder!];
  const a = Math.atan2(h.b.y - s.p[by].b.y, h.b.x - s.p[by].b.x);
  s.crown = { x: h.b.x, y: h.b.y - 30, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380 };
  s.noGrab[s.holder!] = ctx.now() + 700;
  s.p[by].steals++;
  ctx.event('knock', { from: s.holder, by });
  s.holder = null;
}
