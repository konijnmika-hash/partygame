// Snowball Fight: walk over snow piles to pick up snowballs (max 3), then THROW in the direction
// you're moving. A hit scores and freezes the target for a moment. Most hits wins.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const SB = { W: 1000, H: 700, R: 26, BALL_R: 10, MAX: 3 } as const;
const DURATION = 65_000;
const FREEZE_MS = 900;
const THROW_CD = 350;
const SPEED = 640;

interface P { b: Body; balls: number; aimX: number; aimY: number; frozenUntil: number; throwAt: number; hits: number; thrown: number; gotHit: number }
interface Ball { id: number; owner: string; x: number; y: number; vx: number; vy: number; life: number }
interface Pile { id: number; x: number; y: number; left: number; regrowAt: number }

interface S {
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  balls: Ball[];
  piles: Pile[];
  seq: number;
  fx: { x: number; y: number; at: number }[];
}

export const snowballFight = defineGame<S>({
  id: 'snowball-fight',
  realtime: true,
  botDelay: [90, 160],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, SB.W / 2 + Math.cos(a) * 330, SB.H / 2 + Math.sin(a) * 250, SB.R), balls: 1, aimX: Math.cos(a + Math.PI), aimY: Math.sin(a + Math.PI), frozenUntil: 0, throwAt: 0, hits: 0, thrown: 0, gotHit: 0 };
    });
    const piles: Pile[] = [];
    const spots = [[200, 160], [800, 160], [200, 540], [800, 540], [500, 350], [500, 110], [500, 590]];
    spots.forEach(([x, y], i) => piles.push({ id: i + 1, x, y, left: 3, regrowAt: 0 }));
    return { endsAt: 0, p, inputs: {}, btn: new Buttons(), balls: [], piles, seq: 100, fx: [] };
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
      const frozen = pl.frozenUntil > now;
      const f = frozen ? undefined : s.inputs[id];
      steer(pl.b, f, dt, 1500, 290, 3.8);
      if (f && Math.hypot(f.x, f.y) > 0.3) {
        const m = Math.hypot(f.x, f.y);
        pl.aimX = f.x / m;
        pl.aimY = f.y / m;
      }
      if (f && s.btn.pressed(id, f) && pl.balls > 0 && now - pl.throwAt > THROW_CD) {
        pl.balls--;
        pl.throwAt = now;
        pl.thrown++;
        s.balls.push({ id: ++s.seq, owner: id, x: pl.b.x + pl.aimX * 34, y: pl.b.y + pl.aimY * 34, vx: pl.aimX * SPEED, vy: pl.aimY * SPEED, life: 1.2 });
      }
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.8);
    for (const id of ctx.ids) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      clampRect(pl.b, 0, 0, SB.W, SB.H, 0.4);
      // scoop snow from piles
      for (const pile of s.piles) {
        if (pile.left > 0 && pl.balls < SB.MAX && dist(pl.b, pile) < SB.R + 34) {
          pile.left--;
          pl.balls++;
          if (pile.left === 0) pile.regrowAt = now + 4000;
        }
      }
    }
    for (const pile of s.piles) if (pile.left === 0 && now >= pile.regrowAt) pile.left = 3;
    for (const ball of s.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.life -= dt;
      for (const id of ctx.ids) {
        if (id === ball.owner) continue;
        const pl = s.p[id];
        if (dist(pl.b, ball) < SB.R + SB.BALL_R) {
          ball.life = -1;
          s.p[ball.owner].hits++;
          pl.gotHit++;
          pl.frozenUntil = now + FREEZE_MS;
          pl.b.vx += ball.vx * 0.3;
          pl.b.vy += ball.vy * 0.3;
          s.fx.push({ x: r1(ball.x), y: r1(ball.y), at: now });
          ctx.event('splat', { id, by: ball.owner });
          break;
        }
      }
    }
    s.balls = s.balls.filter((b) => b.life > 0 && b.x > -20 && b.x < SB.W + 20 && b.y > -20 && b.y < SB.H + 20);
    s.fx = s.fx.filter((f) => now - f.at < 600);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), n: pl.balls, fz: pl.frozenUntil > now ? 1 : 0, ax: Math.round(pl.aimX * 100) / 100, ay: Math.round(pl.aimY * 100) / 100 };
      }),
      o: s.balls.map((b) => ({ id: b.id, x: r1(b.x), y: r1(b.y) })),
      piles: s.piles.map((p) => ({ x: p.x, y: p.y, n: p.left })),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].hits])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (me.frozenUntil > now) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    if (me.balls === 0) {
      let best = s.piles[0];
      let bd = Infinity;
      for (const p of s.piles) {
        if (p.left === 0) continue;
        const d = dist(me.b, p);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return { input: seek(me.b, best, 0.2) };
    }
    // line up a throw at the nearest rival, leading the target a little
    let target: P | null = null;
    let bd = Infinity;
    for (const id of ctx.ids) {
      if (id === pid) continue;
      const d = dist(me.b, s.p[id].b);
      if (d < bd) {
        bd = d;
        target = s.p[id];
      }
    }
    if (!target) return { input: { x: 0, y: 0, b: 0 } };
    const lead = (bd / SPEED) * skill;
    const tx = target.b.x + target.b.vx * lead;
    const ty = target.b.y + target.b.vy * lead;
    const inp = seek(me.b, { x: tx, y: ty }, (1 - skill) * 0.4);
    if (bd < 420 && now - me.throwAt > THROW_CD && Math.random() < 0.35 + skill * 0.4) inp.b = 1;
    if (bd < 160) {
      inp.x = -inp.x * 0.3 + inp.x * 0.1;
      inp.y = -inp.y * 0.3 + inp.y * 0.1;
    }
    return { input: inp };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => s.p[id].hits));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const acc = pl.thrown ? Math.round((pl.hits / pl.thrown) * 100) : 0;
      perfs[id] = {
        score: pl.hits * 10 - pl.gotHit,
        perf: Math.min(1, pl.hits / best),
        participated: ctx.acted(id),
        highlight: `${pl.hits} hit${pl.hits === 1 ? '' : 's'} (${acc}% accuracy) · splatted ${pl.gotHit}×`,
        bonuses: pl.thrown >= 5 && acc >= 50 ? [{ label: 'Sharpshooter', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});
