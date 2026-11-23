// Bouncy Arena: sumo on a shrinking round platform. Dash into rivals to knock them off.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, collide, dash, dirTo, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const BA = { W: 1000, H: 1000, C: 500, R: 30 } as const;
const ROUNDS = 3;
const RADII = [430, 370, 310];
const ROUND_MAX_MS = 30_000;
const COUNTDOWN_MS = 2200;
const BREAK_MS = 2800;
const DASH_CD = 1300;
const DASH_MS = 260;

interface P {
  b: Body;
  out: boolean;
  outAt: number;
  dashAt: number;
  hitBy: string | null;
  hitAt: number;
  kos: number;
  wins: number;
  falls: number;
}

interface S {
  round: number;
  phase: 'countdown' | 'play' | 'break' | 'over';
  R: number;
  phaseEnds: number;
  roundStart: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  outOrder: string[];
  scores: Record<string, number>;
  fx: { k: 'ko' | 'bump'; x: number; y: number; at: number }[];
  lastWinner: string | null;
}

export const bouncyArena = defineGame<S>({
  id: 'bouncy-arena',
  realtime: true,
  botDelay: [90, 160],
  setup(ctx) {
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { b: makeBody(id, BA.C, BA.C, BA.R), out: false, outAt: 0, dashAt: -99999, hitBy: null, hitAt: 0, kos: 0, wins: 0, falls: 0 };
    return { round: 0, phase: 'countdown', R: RADII[0], phaseEnds: 0, roundStart: 0, p, inputs: {}, btn: new Buttons(), outOrder: [], scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])), fx: [], lastWinner: null };
  },
  start(s, ctx) {
    startRound(s, ctx);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (s.phase === 'countdown') {
      if (now >= s.phaseEnds) {
        s.phase = 'play';
        s.roundStart = now;
        s.phaseEnds = now + ctx.ms(ROUND_MAX_MS);
      }
      return;
    }
    if (s.phase === 'break') {
      if (now >= s.phaseEnds) {
        if (s.round + 1 >= ROUNDS) {
          s.phase = 'over';
          ctx.end();
        } else {
          s.round++;
          startRound(s, ctx);
        }
      }
      return;
    }
    if (s.phase !== 'play') return;
    // the platform slowly shrinks after a grace period
    const t = (now - s.roundStart) / 1000;
    s.R = Math.max(120, RADII[s.round] - Math.max(0, t - 6) * ctx.diff(7, 9, 11));
    const alive = ctx.ids.filter((id) => !s.p[id].out);
    for (const id of alive) {
      const pl = s.p[id];
      const f = s.inputs[id];
      steer(pl.b, f, dt, 1500, 330, 3);
      if (s.btn.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 640);
      }
      pl.b.m = now - pl.dashAt < DASH_MS ? 2.6 : 1;
    }
    const bodies = alive.map((id) => s.p[id].b);
    collide(bodies, 0.95, (a, b, impact) => {
      const pa = s.p[a.id];
      const pb = s.p[b.id];
      pa.hitBy = b.id;
      pa.hitAt = now;
      pb.hitBy = a.id;
      pb.hitAt = now;
      if (impact > 260) s.fx.push({ k: 'bump', x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2), at: now });
    });
    for (const id of alive) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      if (dist(pl.b, { x: BA.C, y: BA.C }) > s.R + 6) knockOut(s, ctx, id);
    }
    s.fx = s.fx.filter((f) => now - f.at < 900);
    const left = ctx.ids.filter((id) => !s.p[id].out);
    if ((ctx.ids.length > 1 && left.length <= 1) || left.length === 0 || now >= s.phaseEnds) endRound(s, ctx);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      R: r1(s.R),
      phaseEnds: s.phaseEnds,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), o: pl.out ? 1 : 0, oa: pl.outAt, d: now - pl.dashAt < DASH_MS ? 1 : 0, cd: Math.max(0, Math.round(DASH_CD - (now - pl.dashAt))) };
      }),
      fx: s.fx,
      scores: s.scores,
      winner: s.phase === 'break' ? s.lastWinner : null,
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    if (s.phase !== 'play' || me.out) return { input: { x: 0, y: 0, b: 0 } };
    const c = { x: BA.C, y: BA.C };
    const dc = dist(me.b, c);
    if (dc > s.R * 0.72) return { input: seek(me.b, c, 0.1) };
    let target: P | null = null;
    let bd = Infinity;
    for (const id of ctx.ids) {
      if (id === pid || s.p[id].out) continue;
      const d = dist(me.b, s.p[id].b);
      if (d < bd) {
        bd = d;
        target = s.p[id];
      }
    }
    if (!target) return { input: seek(me.b, c, 0.3) };
    // aim to push the rival outward: approach from the centre side
    const out = dirTo(c, target.b);
    const aim = { x: target.b.x - out.x * 20, y: target.b.y - out.y * 20 };
    const inp = seek(me.b, aim, ctx.diff(0.5, 0.3, 0.15));
    const ready = ctx.now() - me.dashAt > DASH_CD;
    if (ready && bd < ctx.diff(120, 160, 190) && Math.random() < ctx.diff(0.35, 0.6, 0.85)) inp.b = 1;
    return { input: inp };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const best = Math.max(1, ...Object.values(s.scores));
    for (const id of ctx.ids) {
      const pl = s.p[id];
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / best),
        participated: ctx.acted(id),
        highlight: `${pl.wins} round win${pl.wins === 1 ? '' : 's'} · ${pl.kos} KO${pl.kos === 1 ? '' : 's'} · fell ${pl.falls}×`,
        bonuses: pl.falls === 0 ? [{ label: 'Never fell off', pts: 40 }] : [],
      };
    }
    return { perfs, stats: Object.fromEntries(ctx.ids.map((id) => [id, { kos: s.p[id].kos }])) };
  },
});

function startRound(s: S, ctx: GameCtx) {
  s.R = RADII[s.round];
  s.outOrder = [];
  s.lastWinner = null;
  const n = ctx.ids.length;
  const ring = s.R * 0.62;
  const off = ctx.rng.next() * Math.PI * 2;
  ctx.ids.forEach((id, i) => {
    const a = off + (i / n) * Math.PI * 2;
    const pl = s.p[id];
    pl.b.x = BA.C + Math.cos(a) * ring;
    pl.b.y = BA.C + Math.sin(a) * ring;
    pl.b.vx = 0;
    pl.b.vy = 0;
    pl.out = false;
    pl.hitBy = null;
    pl.dashAt = -99999;
  });
  s.phase = 'countdown';
  s.phaseEnds = ctx.now() + COUNTDOWN_MS;
  ctx.dirty();
}

function knockOut(s: S, ctx: GameCtx, id: string) {
  const now = ctx.now();
  const pl = s.p[id];
  pl.out = true;
  pl.outAt = now;
  pl.falls++;
  s.outOrder.push(id);
  // points for everyone eliminated so far: later = more
  s.scores[id] += (s.outOrder.length - 1) * 10;
  if (pl.hitBy && pl.hitBy !== id && now - pl.hitAt < 2500 && !s.p[pl.hitBy].out) {
    s.p[pl.hitBy].kos++;
    s.scores[pl.hitBy] += 25;
  }
  s.fx.push({ k: 'ko', x: r1(pl.b.x), y: r1(pl.b.y), at: now });
  ctx.event('ko', { id, by: pl.hitBy });
}

function endRound(s: S, ctx: GameCtx) {
  const left = ctx.ids.filter((id) => !s.p[id].out);
  const n = ctx.ids.length;
  for (const id of left) {
    s.scores[id] += left.length === 1 ? n * 10 + 40 : (n - left.length) * 10 + 15;
    if (left.length === 1) s.p[id].wins++;
  }
  s.lastWinner = left.length === 1 ? left[0] : null;
  s.phase = 'break';
  s.phaseEnds = ctx.now() + BREAK_MS;
  ctx.event('round', { winner: s.lastWinner });
  ctx.dirty();
}
