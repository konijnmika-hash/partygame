// Push the Button: stand alone on the giant button to charge points. Dash to shove rivals off.
// The button glides to a new spot every few seconds (announced shortly before).
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dash, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const PB = { W: 1000, H: 700, BR: 78, R: 28 } as const;
const DURATION = 60_000;
const MOVE_EVERY = 8000;
const WARN_MS = 1600;
const GLIDE_MS = 1100;
const DASH_CD = 1200;
const DASH_MS = 240;
const RATE = 10; // points per second on the button

interface P {
  b: Body;
  pts: number;
  dashAt: number;
  stunUntil: number;
  onTime: number;
  shoves: number;
}

interface S {
  endsAt: number;
  btn: { x: number; y: number };
  from: { x: number; y: number };
  next: { x: number; y: number; at: number } | null;
  target: { x: number; y: number } | null;
  glideStart: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  buttons: Buttons;
  owner: string | null;
  contested: boolean;
  fx: { k: 'shove'; x: number; y: number; at: number }[];
}

export const pushButton = defineGame<S>({
  id: 'push-button',
  realtime: true,
  botDelay: [90, 160],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, PB.W / 2 + Math.cos(a) * 300, PB.H / 2 + Math.sin(a) * 230, PB.R), pts: 0, dashAt: -99999, stunUntil: 0, onTime: 0, shoves: 0 };
    });
    const btn = { x: PB.W / 2, y: PB.H / 2 };
    return { endsAt: 0, btn, from: { ...btn }, next: null, target: null, glideStart: 0, p, inputs: {}, buttons: new Buttons(), owner: null, contested: false, fx: [] };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
    s.next = { ...randomSpot(s, () => ctx.rng.next()), at: ctx.now() + MOVE_EVERY };
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    // button movement
    if (s.next && now >= s.next.at) {
      s.from = { ...s.btn };
      s.glideStart = now;
      s.target = { x: s.next.x, y: s.next.y };
      s.next = { ...randomSpot({ btn: s.target }, () => ctx.rng.next()), at: now + MOVE_EVERY };
    }
    if (s.target) {
      const k = Math.min(1, (now - s.glideStart) / GLIDE_MS);
      const e = k * k * (3 - 2 * k);
      s.btn = { x: s.from.x + (s.target.x - s.from.x) * e, y: s.from.y + (s.target.y - s.from.y) * e };
      if (k >= 1) s.target = null;
    }
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const f = pl.stunUntil > now ? undefined : s.inputs[id];
      steer(pl.b, f, dt, 1500, 320, 3.2);
      if (f && s.buttons.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 620);
      }
      pl.b.m = now - pl.dashAt < DASH_MS ? 2.4 : 1;
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.9, (a, b, impact) => {
      const pa = s.p[a.id];
      const pb = s.p[b.id];
      const aDash = now - pa.dashAt < DASH_MS;
      const bDash = now - pb.dashAt < DASH_MS;
      if (aDash && !bDash && impact > 200) {
        pb.stunUntil = now + 450;
        pa.shoves++;
        s.fx.push({ k: 'shove', x: r1(b.x), y: r1(b.y), at: now });
      } else if (bDash && !aDash && impact > 200) {
        pa.stunUntil = now + 450;
        pb.shoves++;
        s.fx.push({ k: 'shove', x: r1(a.x), y: r1(a.y), at: now });
      }
    });
    const on: string[] = [];
    for (const id of ctx.ids) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      clampRect(pl.b, 0, 0, PB.W, PB.H, 0.6);
      if (dist(pl.b, s.btn) < PB.BR) on.push(id);
    }
    s.contested = on.length > 1;
    s.owner = on.length === 1 ? on[0] : null;
    if (s.owner) {
      s.p[s.owner].pts += RATE * dt;
      s.p[s.owner].onTime += dt;
    }
    s.fx = s.fx.filter((f) => now - f.at < 700);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      btn: { x: r1(s.btn.x), y: r1(s.btn.y) },
      next: s.next && s.next.at - now < WARN_MS ? { x: r1(s.next.x), y: r1(s.next.y) } : null,
      owner: s.owner,
      contested: s.contested,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), d: now - pl.dashAt < DASH_MS ? 1 : 0, st: pl.stunUntil > now ? 1 : 0, cd: Math.max(0, Math.round(DASH_CD - (now - pl.dashAt))) };
      }),
      scores: Object.fromEntries(ctx.ids.map((id) => [id, Math.floor(s.p[id].pts)])),
      fx: s.fx,
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.stunUntil > now) return { input: { x: 0, y: 0, b: 0 } };
    const goal = s.next && s.next.at - now < 900 ? s.next : s.btn;
    const inp = seek(me.b, goal, ctx.diff(0.5, 0.3, 0.15));
    const onIt = dist(me.b, s.btn) < PB.BR;
    if (onIt && !s.contested) {
      // hold position near the centre
      const d = dist(me.b, s.btn);
      if (d < 25) return { input: { x: 0, y: 0, b: 0 } };
    }
    if (now - me.dashAt > DASH_CD) {
      for (const id of ctx.ids) {
        if (id === pid) continue;
        const o = s.p[id];
        if (dist(o.b, s.btn) < PB.BR + 20 && dist(me.b, o.b) < ctx.diff(110, 150, 180) && Math.random() < ctx.diff(0.3, 0.55, 0.8)) {
          const sh = seek(me.b, o.b, 0.05);
          sh.b = 1;
          return { input: sh };
        }
      }
    }
    return { input: inp };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const best = Math.max(10, ...ctx.ids.map((id) => s.p[id].pts));
    for (const id of ctx.ids) {
      const pl = s.p[id];
      perfs[id] = {
        score: Math.floor(pl.pts),
        perf: Math.min(1, pl.pts / best),
        participated: ctx.acted(id),
        highlight: `${pl.onTime.toFixed(1)} s on the button · ${pl.shoves} shove${pl.shoves === 1 ? '' : 's'}`,
        bonuses: pl.shoves >= 5 ? [{ label: 'Bulldozer', pts: 25 }] : [],
      };
    }
    return { perfs };
  },
});

function randomSpot(s: { btn: { x: number; y: number } }, rnd: () => number): { x: number; y: number } {
  for (let i = 0; i < 20; i++) {
    const x = 130 + rnd() * (PB.W - 260);
    const y = 120 + rnd() * (PB.H - 240);
    if (dist({ x, y }, s.btn) > 280) return { x, y };
  }
  return { x: PB.W - s.btn.x, y: PB.H - s.btn.y };
}
