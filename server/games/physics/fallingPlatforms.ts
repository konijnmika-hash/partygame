// Falling Platforms: every tile you stand on cracks; once it is worn through it falls a moment
// later. Keep moving over fresh tiles, jump over gaps, bump rivals into holes. Holes grow back
// for a while, then the floor starts crumbling on its own. Last Bloop standing wins.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, collide, integrate, makeBody, r1, steer, type Body } from '../../engine/arena';
import { FP, FP_H, FP_W, tileAt, tileCentre } from '@shared/fallingPlatforms';

const CAP_MS = 75_000;
const JUMP_MS = 520;
const JUMP_CD = 850;
const FALL_DELAY = 450;
/** after this, fallen tiles stop growing back and random tiles start to crumble */
const DECAY_AFTER = 40_000;

interface P {
  b: Body;
  out: boolean;
  outAt: number;
  jumpAt: number;
  place: number;
  worn: number;
  jumps: number;
}

interface S {
  t0: number;
  endsAt: number;
  /** remaining durability per tile in ms of standing */
  dur: number[];
  /** time the tile will drop (0 = not crumbling) */
  dropAt: number[];
  /** time the tile fell (0 = present) */
  goneAt: number[];
  maxDur: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  outCount: number;
  nextDecay: number;
  bot: Record<string, { tile: number; until: number }>;
}

export const fallingPlatforms = defineGame<S>({
  id: 'falling-platforms',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, FP_W / 2 + Math.cos(a) * 280, FP_H / 2 + Math.sin(a) * 200, FP.R), out: false, outAt: 0, jumpAt: -99999, place: 0, worn: 0, jumps: 0 };
    });
    const maxDur = ctx.diff(2200, 1600, 1200);
    const T = FP.COLS * FP.ROWS;
    return { t0: 0, endsAt: 0, dur: new Array(T).fill(maxDur), dropAt: new Array(T).fill(0), goneAt: new Array(T).fill(0), maxDur, p, inputs: {}, btn: new Buttons(), outCount: 0, nextDecay: 0, bot: {} };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1200;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    s.nextDecay = s.t0 + ctx.ms(DECAY_AFTER);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return finish(s, ctx);
    const elapsed = now - s.t0;
    const decaying = elapsed >= ctx.ms(DECAY_AFTER);
    const regrow = ctx.diff(5000, 6000, 7000) * (1 + elapsed / 25_000);
    for (let i = 0; i < s.dur.length; i++) {
      if (s.dropAt[i] && now >= s.dropAt[i]) {
        s.dropAt[i] = 0;
        s.goneAt[i] = now;
      } else if (s.goneAt[i] && !decaying && now - s.goneAt[i] >= regrow && !occupied(s, ctx, i)) {
        s.goneAt[i] = 0;
        s.dur[i] = s.maxDur;
      }
    }
    // late game: the floor crumbles on its own
    if (decaying && now >= s.nextDecay) {
      const solid: number[] = [];
      for (let i = 0; i < s.dur.length; i++) if (!s.goneAt[i] && !s.dropAt[i]) solid.push(i);
      if (solid.length) s.dropAt[ctx.rng.pick(solid)] = now + FALL_DELAY * 2;
      s.nextDecay = now + ctx.diff(480, 360, 260);
    }
    const alive = ctx.ids.filter((id) => !s.p[id].out);
    for (const id of alive) {
      const pl = s.p[id];
      const f = s.inputs[id];
      steer(pl.b, f, dt, 1400, 255, 3.6);
      if (s.btn.pressed(id, f) && now - pl.jumpAt > JUMP_MS + JUMP_CD) {
        pl.jumpAt = now;
        pl.jumps++;
      }
    }
    // airborne players don't bump grounded ones
    const grounded = alive.filter((id) => now - s.p[id].jumpAt >= JUMP_MS);
    collide(grounded.map((id) => s.p[id].b), 1.1);
    for (const id of alive) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      const b = pl.b;
      b.x = Math.max(b.r, Math.min(FP_W - b.r, b.x));
      b.y = Math.max(b.r, Math.min(FP_H - b.r, b.y));
      if (now - pl.jumpAt < JUMP_MS) continue;
      const ti = tileAt(b.x, b.y);
      if (ti < 0 || s.goneAt[ti]) {
        pl.out = true;
        pl.outAt = now;
        pl.place = ctx.ids.length - s.outCount;
        s.outCount++;
        ctx.event('fall', { id });
        continue;
      }
      if (!s.dropAt[ti]) {
        s.dur[ti] -= dt * 1000;
        pl.worn += dt;
        if (s.dur[ti] <= 0) {
          s.dur[ti] = 0;
          s.dropAt[ti] = now + FALL_DELAY;
        }
      }
    }
    const left = ctx.ids.filter((id) => !s.p[id].out);
    if ((ctx.ids.length > 1 && left.length <= 1) || left.length === 0) finish(s, ctx);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      // per tile: -1 gone, 10 about to drop, otherwise wear 0 (fresh) .. 9 (nearly worn through)
      tiles: s.dur.map((d, i) => (s.goneAt[i] ? -1 : s.dropAt[i] ? 10 : Math.min(9, Math.floor((1 - d / s.maxDur) * 10)))),
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        const air = now - pl.jumpAt < JUMP_MS ? Math.round(((now - pl.jumpAt) / JUMP_MS) * 100) / 100 : 0;
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), o: pl.out ? 1 : 0, oa: pl.outAt, j: air };
      }),
      left: ctx.ids.filter((id) => !s.p[id].out).length,
      decay: now - s.t0 >= ctx.ms(DECAY_AFTER),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.out || now < s.t0) return { input: { x: 0, y: 0, b: 0 } };
    const b = me.b;
    const skill = ctx.diff(0.45, 0.7, 0.9);
    const here = tileAt(b.x, b.y);
    let plan = s.bot[pid];
    const usable = (i: number) => i >= 0 && !s.goneAt[i] && !s.dropAt[i];
    if (!plan || now > plan.until || plan.tile === here || !usable(plan.tile)) {
      // pick a healthy tile nearby, with healthy neighbours, away from rivals
      let best = -1;
      let bs = -Infinity;
      for (let i = 0; i < s.dur.length; i++) {
        if (!usable(i) || i === here) continue;
        const c = tileCentre(i);
        const d = Math.hypot(c.x - b.x, c.y - b.y);
        if (d > FP.TILE * 3.2) continue;
        let sc = (s.dur[i] / s.maxDur) * 2 + healthyNeighbours(s, i) * 0.8 - Math.abs(d - FP.TILE * 1.5) / FP.TILE;
        for (const id of ctx.ids) {
          if (id === pid || s.p[id].out) continue;
          const o = s.p[id].b;
          const od = Math.hypot(c.x - o.x, c.y - o.y);
          if (od < 140) sc -= (140 - od) / 50;
        }
        sc += (Math.random() - 0.5) * (1 - skill) * 3;
        if (sc > bs) {
          bs = sc;
          best = i;
        }
      }
      plan = s.bot[pid] = { tile: best, until: now + 1100 };
    }
    if (plan.tile < 0) return { input: { x: Math.random() - 0.5, y: Math.random() - 0.5, b: 0 } };
    const c = tileCentre(plan.tile);
    const dx = c.x - b.x;
    const dy = c.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    // jump when the next step is a hole
    const ahead = tileAt(b.x + (dx / d) * 38, b.y + (dy / d) * 38);
    const hole = ahead < 0 || !!s.goneAt[ahead];
    const canJump = now - me.jumpAt > JUMP_MS + JUMP_CD;
    // slow down near the target so we don't overshoot into holes
    const k = Math.min(1, d / 60 + 0.35);
    return { input: { x: (dx / d) * k, y: (dy / d) * k, b: hole && canJump && Math.random() < skill + 0.1 ? 1 : 0 } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const n = ctx.ids.length;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const place = pl.place || 1;
      const survived = pl.out ? (pl.outAt - s.t0) / 1000 : (Math.min(ctx.now(), s.endsAt) - s.t0) / 1000;
      perfs[id] = {
        score: (n - place) * 1000 + Math.round(survived * 10),
        perf: n > 1 ? (n - place) / (n - 1) : 1,
        participated: ctx.acted(id),
        highlight: `${pl.out ? `Fell after ${survived.toFixed(1)} s` : '🏆 Still standing!'} · ${pl.jumps} jump${pl.jumps === 1 ? '' : 's'}`,
      };
    }
    return { perfs };
  },
});

function occupied(s: S, ctx: GameCtx, i: number): boolean {
  for (const id of ctx.ids) {
    const pl = s.p[id];
    if (!pl.out && tileAt(pl.b.x, pl.b.y) === i) return true;
  }
  return false;
}

function healthyNeighbours(s: S, i: number): number {
  const c = i % FP.COLS;
  const r = Math.floor(i / FP.COLS);
  let n = 0;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const cc = c + dc;
    const rr = r + dr;
    if (cc < 0 || rr < 0 || cc >= FP.COLS || rr >= FP.ROWS) continue;
    const j = rr * FP.COLS + cc;
    if (!s.goneAt[j] && !s.dropAt[j]) n += s.dur[j] / s.maxDur;
  }
  return n;
}

function finish(s: S, ctx: GameCtx) {
  // survivors share first place
  for (const id of ctx.ids) if (!s.p[id].out) s.p[id].place = 1;
  ctx.end();
}
