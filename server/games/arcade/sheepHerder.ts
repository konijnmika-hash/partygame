// Sheep Herder: sheep flee from nearby Bloops. Herd them into YOUR coloured pen in a corner of
// the meadow. Sheep in your pen at the end count — and you can steal from rival pens.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { clampRect, collide, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const SH = { W: 1000, H: 700, R: 26, SHEEP_R: 18, PEN: 150 } as const;
const DURATION = 75_000;
const SHEEP = 22;
export const PENS = [
  { x: 0, y: 0 },
  { x: SH.W - SH.PEN, y: SH.H - SH.PEN },
  { x: SH.W - SH.PEN, y: 0 },
  { x: 0, y: SH.H - SH.PEN },
];

interface Sheep { id: number; x: number; y: number; vx: number; vy: number; wx: number; wy: number; next: number }
interface S {
  endsAt: number;
  p: Record<string, { b: Body; pen: number }>;
  inputs: Record<string, InputFrame>;
  sheep: Sheep[];
}

function penOf(x: number, y: number, n: number): number {
  for (let k = 0; k < n; k++) {
    const p = PENS[k];
    if (x > p.x && x < p.x + SH.PEN && y > p.y && y < p.y + SH.PEN) return k;
  }
  return -1;
}

export const sheepHerder = defineGame<S>({
  id: 'sheep-herder',
  realtime: true,
  botDelay: [100, 170],
  setup(ctx) {
    const p: Record<string, { b: Body; pen: number }> = {};
    ctx.ids.forEach((id, i) => {
      const pen = PENS[i];
      p[id] = { b: makeBody(id, pen.x + SH.PEN / 2, pen.y + SH.PEN / 2, SH.R), pen: i };
    });
    const sheep: Sheep[] = [];
    for (let i = 0; i < SHEEP; i++) sheep.push({ id: i + 1, x: 260 + ctx.rng.next() * 480, y: 190 + ctx.rng.next() * 320, vx: 0, vy: 0, wx: 0, wy: 0, next: 0 });
    return { endsAt: 0, p, inputs: {}, sheep };
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
    for (const id of ctx.ids) steer(s.p[id].b, s.inputs[id], dt, 1500, 300, 3.6);
    collide(ctx.ids.map((id) => s.p[id].b), 0.8);
    for (const id of ctx.ids) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, SH.W, SH.H, 0.4);
    }
    const n = ctx.ids.length;
    for (const sh of s.sheep) {
      // flee from Bloops, flock loosely, wander a bit
      let ax = 0;
      let ay = 0;
      for (const id of ctx.ids) {
        const b = s.p[id].b;
        const d = Math.hypot(sh.x - b.x, sh.y - b.y) || 1;
        if (d < 170) {
          const k = ((170 - d) / 170) * 900;
          ax += ((sh.x - b.x) / d) * k;
          ay += ((sh.y - b.y) / d) * k;
        }
      }
      if (now > sh.next) {
        const a = ctx.rng.next() * Math.PI * 2;
        sh.wx = Math.cos(a) * 40;
        sh.wy = Math.sin(a) * 40;
        sh.next = now + 1500 + ctx.rng.int(0, 2000);
      }
      // sheep calmly stay inside a pen once they're in one
      const inPen = penOf(sh.x, sh.y, n) >= 0;
      ax += inPen ? sh.wx * 0.2 : sh.wx;
      ay += inPen ? sh.wy * 0.2 : sh.wy;
      sh.vx = (sh.vx + ax * dt) * Math.max(0, 1 - 2.6 * dt);
      sh.vy = (sh.vy + ay * dt) * Math.max(0, 1 - 2.6 * dt);
      const sp = Math.hypot(sh.vx, sh.vy);
      if (sp > 260) {
        sh.vx *= 260 / sp;
        sh.vy *= 260 / sp;
      }
      sh.x = Math.max(SH.SHEEP_R, Math.min(SH.W - SH.SHEEP_R, sh.x + sh.vx * dt));
      sh.y = Math.max(SH.SHEEP_R, Math.min(SH.H - SH.SHEEP_R, sh.y + sh.vy * dt));
    }
    // sheep don't overlap each other too much
    for (let i = 0; i < s.sheep.length; i++) {
      for (let j = i + 1; j < s.sheep.length; j++) {
        const a = s.sheep[i];
        const b = s.sheep[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < SH.SHEEP_R * 2) {
          const push = (SH.SHEEP_R * 2 - d) / 2;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
  },
  pub(s, ctx) {
    const counts = penCounts(s, ctx.ids.length);
    return {
      endsAt: s.endsAt,
      pens: ctx.ids.map((id) => s.p[id].pen),
      p: ctx.ids.map((id) => ({ id, x: r1(s.p[id].b.x), y: r1(s.p[id].b.y), pen: s.p[id].pen })),
      o: s.sheep.map((sh) => ({ id: sh.id, x: r1(sh.x), y: r1(sh.y) })),
      scores: Object.fromEntries(ctx.ids.map((id) => [id, counts[s.p[id].pen] ?? 0])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const pen = PENS[me.pen];
    const pc = { x: pen.x + SH.PEN / 2, y: pen.y + SH.PEN / 2 };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    // pick the free sheep closest to our pen and get behind it (on the far side from the pen)
    let target: Sheep | null = null;
    let bd = Infinity;
    for (const sh of s.sheep) {
      if (penOf(sh.x, sh.y, ctx.ids.length) === me.pen) continue;
      const d = Math.hypot(sh.x - pc.x, sh.y - pc.y) + Math.hypot(sh.x - me.b.x, sh.y - me.b.y) * 0.5;
      if (d < bd) {
        bd = d;
        target = sh;
      }
    }
    if (!target) return { input: seek(me.b, pc, 0.2) };
    const dx = target.x - pc.x;
    const dy = target.y - pc.y;
    const d = Math.hypot(dx, dy) || 1;
    const behind = { x: target.x + (dx / d) * 90, y: target.y + (dy / d) * 90 };
    return { input: seek(me.b, dist(me.b, behind) > 40 ? behind : target, (1 - skill) * 0.4) };
  },
  results(s, ctx) {
    const counts = penCounts(s, ctx.ids.length);
    const best = Math.max(1, ...Object.values(counts));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const c = counts[s.p[id].pen] ?? 0;
      perfs[id] = { score: c, perf: Math.min(1, c / best), participated: ctx.acted(id), highlight: `🐑 ${c} sheep in your pen` };
    }
    return { perfs };
  },
});

function penCounts(s: S, n: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const sh of s.sheep) {
    const k = penOf(sh.x, sh.y, n);
    if (k >= 0) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
