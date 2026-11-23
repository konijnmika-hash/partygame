// Paddle Royale: everyone defends one side of a polygon arena with a paddle. Balls bounce
// everywhere; every ball that slips past you costs a life. Out of lives? Your side becomes a wall.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { r1 } from '../../engine/arena';

export const PR = { C: 500, RAD: 430, BALL_R: 12, PAD: 0.24, LIVES: 3 } as const;
const MAX_MS = 100_000;

export interface Side { ax: number; ay: number; bx: number; by: number; mx: number; my: number; nx: number; ny: number; rx: number; ry: number; len: number; owner: string | null }
interface Ball { id: number; x: number; y: number; vx: number; vy: number; wait: number }

interface S {
  t0: number;
  endsAt: number;
  sides: Side[];
  pad: Record<string, number>;
  lives: Record<string, number>;
  outAt: Record<string, number>;
  saves: Record<string, number>;
  inputs: Record<string, InputFrame>;
  balls: Ball[];
  seq: number;
  fx: { x: number; y: number; at: number; k: 'goal' | 'hit' }[];
}

/** Regular polygon; players get every side (or every other side for 2–3 players). */
export function makeSides(ids: string[]): Side[] {
  const n = ids.length;
  const K = n === 2 ? 4 : n === 3 ? 6 : n;
  const step = n === 2 || n === 3 ? 2 : 1;
  const sides: Side[] = [];
  const off = Math.PI / 2 + Math.PI / K;
  for (let i = 0; i < K; i++) {
    const a0 = off + (i / K) * Math.PI * 2;
    const a1 = off + ((i + 1) / K) * Math.PI * 2;
    const ax = PR.C + Math.cos(a0) * PR.RAD;
    const ay = PR.C + Math.sin(a0) * PR.RAD;
    const bx = PR.C + Math.cos(a1) * PR.RAD;
    const by = PR.C + Math.sin(a1) * PR.RAD;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const nl = Math.hypot(PR.C - mx, PR.C - my);
    const nx = (PR.C - mx) / nl;
    const ny = (PR.C - my) / nl;
    // "screen right" for someone standing on this side looking at the centre
    const rx = -ny;
    const ry = nx;
    sides.push({ ax, ay, bx, by, mx, my, nx, ny, rx, ry, len: Math.hypot(bx - ax, by - ay), owner: i % step === 0 ? ids[i / step] ?? null : null });
  }
  return sides;
}

export const paddleRoyale = defineGame<S>({
  id: 'paddle-royale',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const sides = makeSides(ctx.ids);
    return {
      t0: 0,
      endsAt: 0,
      sides,
      pad: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      lives: Object.fromEntries(ctx.ids.map((id) => [id, PR.LIVES])),
      outAt: {},
      saves: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      inputs: {},
      balls: [],
      seq: 0,
      fx: [],
    };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 2000;
    s.endsAt = s.t0 + ctx.ms(MAX_MS);
    addBall(s, ctx, 0);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return ctx.end();
    const el = (now - s.t0) / 1000;
    const want = Math.min(3, 1 + Math.floor(el / 20));
    if (s.balls.length < want) addBall(s, ctx, 600);
    for (const side of s.sides) {
      if (!side.owner || s.lives[side.owner] <= 0) continue;
      const f = s.inputs[side.owner];
      const half = side.len * (0.5 - PR.PAD / 2) - 6;
      s.pad[side.owner] = Math.max(-half, Math.min(half, s.pad[side.owner] + (f?.x ?? 0) * 520 * dt));
    }
    const speed = Math.min(560, 300 + el * 4);
    for (const ball of s.balls) {
      if (ball.wait > 0) {
        ball.wait -= dt * 1000;
        continue;
      }
      // keep a steady speed (slowly rising)
      const sp = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = (ball.vx / sp) * speed;
      ball.vy = (ball.vy / sp) * speed;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      for (const side of s.sides) {
        const dist = (ball.x - side.mx) * side.nx + (ball.y - side.my) * side.ny;
        const vn = ball.vx * side.nx + ball.vy * side.ny;
        if (dist >= PR.BALL_R || vn >= 0) continue;
        const u = (ball.x - side.mx) * side.rx + (ball.y - side.my) * side.ry;
        const owner = side.owner && s.lives[side.owner] > 0 ? side.owner : null;
        const padHalf = (side.len * PR.PAD) / 2;
        if (owner && Math.abs(u - s.pad[owner]) > padHalf + PR.BALL_R) {
          // it got past the paddle
          s.lives[owner]--;
          s.fx.push({ x: r1(ball.x), y: r1(ball.y), at: now, k: 'goal' });
          ctx.event('miss', { id: owner, lives: s.lives[owner] });
          if (s.lives[owner] <= 0) s.outAt[owner] = now;
          resetBall(s, ctx, ball);
          break;
        }
        // bounce; paddle hits add spin based on where the ball struck
        ball.vx -= 2 * vn * side.nx;
        ball.vy -= 2 * vn * side.ny;
        ball.x += side.nx * (PR.BALL_R - dist);
        ball.y += side.ny * (PR.BALL_R - dist);
        if (owner) {
          const off = (u - s.pad[owner]) / padHalf;
          ball.vx += side.rx * off * speed * 0.5;
          ball.vy += side.ry * off * speed * 0.5;
          s.saves[owner]++;
          s.fx.push({ x: r1(ball.x), y: r1(ball.y), at: now, k: 'hit' });
        }
      }
      // safety: never leave the arena
      if (Math.hypot(ball.x - PR.C, ball.y - PR.C) > PR.RAD + 40) resetBall(s, ctx, ball);
    }
    s.fx = s.fx.filter((f) => now - f.at < 600);
    const alive = ctx.ids.filter((id) => s.lives[id] > 0);
    if ((ctx.ids.length > 1 && alive.length <= 1) || alive.length === 0) ctx.end();
  },
  pub(s, ctx) {
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      sides: s.sides.map((sd) => ({ ax: r1(sd.ax), ay: r1(sd.ay), bx: r1(sd.bx), by: r1(sd.by), o: sd.owner })),
      // paddle offsets along each side as an id-keyed list so clients interpolate them smoothly
      p: ctx.ids.map((id) => ({ id, x: r1(s.pad[id]) })),
      lives: s.lives,
      padLen: PR.PAD,
      o: s.balls.map((b) => ({ id: b.id, x: r1(b.x), y: r1(b.y), w: b.wait > 0 ? 1 : 0 })),
      fx: s.fx,
    };
  },
  bot(s, ctx, pid) {
    const side = s.sides.find((sd) => sd.owner === pid);
    if (!side || s.lives[pid] <= 0) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.5, 0.72, 0.9);
    // track the ball that will reach our side first
    let target = 0;
    let soonest = Infinity;
    for (const ball of s.balls) {
      if (ball.wait > 0) continue;
      const dist = (ball.x - side.mx) * side.nx + (ball.y - side.my) * side.ny;
      const vn = ball.vx * side.nx + ball.vy * side.ny;
      if (vn >= 0) continue;
      const t = (dist - PR.BALL_R) / -vn;
      if (t < soonest) {
        soonest = t;
        const u = (ball.x - side.mx) * side.rx + (ball.y - side.my) * side.ry;
        const vu = ball.vx * side.rx + ball.vy * side.ry;
        target = u + vu * t * skill;
      }
    }
    if (soonest === Infinity) target = 0;
    target += (Math.random() - 0.5) * (1 - skill) * 80;
    const d = target - s.pad[pid];
    return { input: { x: Math.abs(d) < 8 ? 0 : Math.max(-1, Math.min(1, d / 40)), y: 0, b: 0 } };
  },
  results(s, ctx) {
    const n = ctx.ids.length;
    const order = [...ctx.ids].sort((a, b) => (s.lives[b] - s.lives[a]) || ((s.outAt[b] ?? Infinity) - (s.outAt[a] ?? Infinity)));
    const perfs: Record<string, any> = {};
    order.forEach((id, k) => {
      perfs[id] = {
        score: (n - k) * 1000 + s.lives[id] * 100 + s.saves[id],
        perf: n > 1 ? (n - 1 - k) / (n - 1) : 1,
        participated: ctx.acted(id),
        highlight: `${s.lives[id] > 0 ? `🏓 ${s.lives[id]} li${s.lives[id] === 1 ? 'fe' : 'ves'} left` : 'Knocked out'} · ${s.saves[id]} save${s.saves[id] === 1 ? '' : 's'}`,
        bonuses: s.lives[id] === PR.LIVES ? [{ label: 'Clean sheet', pts: 40 }] : [],
      };
    });
    return { perfs };
  },
});

function addBall(s: S, ctx: GameCtx, wait: number) {
  const b: Ball = { id: ++s.seq, x: PR.C, y: PR.C, vx: 0, vy: 0, wait };
  resetBall(s, ctx, b);
  b.wait = wait;
  s.balls.push(b);
}

function resetBall(s: S, ctx: GameCtx, b: Ball) {
  // serve toward a random living player's side
  const live = s.sides.filter((sd) => sd.owner && s.lives[sd.owner] > 0);
  const side = live.length ? ctx.rng.pick(live) : s.sides[0];
  const a = Math.atan2(-side.ny, -side.nx) + (ctx.rng.next() - 0.5) * 0.9;
  b.x = PR.C;
  b.y = PR.C;
  b.vx = Math.cos(a) * 300;
  b.vy = Math.sin(a) * 300;
  b.wait = 900;
}
