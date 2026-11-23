// Zombie Tag: one Bloop starts as a zombie; zombies tag humans to infect them. Humans score for
// every second survived, zombies for every infection; the last human standing wins big. Three
// rounds, each starting with a different zombie.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dash, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const ZT = { W: 1200, H: 800, R: 26 } as const;
const ROUNDS = 3;
const ROUND_MAX_MS = 40_000;
const COUNT_MS = 2000;
const BREAK_MS = 3000;
const DASH_CD = 3500;
const LUNGE_CD = 3000;
const TURN_MS = 1400;

interface P { b: Body; zombie: boolean; turnedAt: number; survived: number; infections: number; dashAt: number; lastHuman: number }

interface S {
  round: number;
  phase: 'count' | 'play' | 'break' | 'over';
  phaseEnds: number;
  firsts: string[];
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  fx: { x: number; y: number; at: number }[];
  survivor: string | null;
}

export const zombieTag = defineGame<S>({
  id: 'zombie-tag',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { b: makeBody(id, ZT.W / 2, ZT.H / 2, ZT.R), zombie: false, turnedAt: 0, survived: 0, infections: 0, dashAt: -99999, lastHuman: 0 };
    return { round: 0, phase: 'count', phaseEnds: 0, firsts: ctx.rng.shuffle(ctx.ids), p, inputs: {}, btn: new Buttons(), fx: [], survivor: null };
  },
  start(s, ctx) {
    startRound(s, ctx);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (s.phase === 'count') {
      if (now >= s.phaseEnds) {
        s.phase = 'play';
        s.phaseEnds = now + ctx.ms(ROUND_MAX_MS);
        ctx.dirty();
      }
      return;
    }
    if (s.phase === 'break') {
      if (now >= s.phaseEnds) {
        if (s.round + 1 >= ROUNDS) {
          s.phase = 'over';
          return ctx.end();
        }
        s.round++;
        startRound(s, ctx);
      }
      return;
    }
    if (s.phase !== 'play') return;
    for (const id of ctx.ids) {
      const pl = s.p[id];
      // freshly turned zombies shamble in place for a moment (gives humans time to scatter)
      const f = pl.zombie && now - pl.turnedAt < TURN_MS ? undefined : s.inputs[id];
      steer(pl.b, f, dt, 1500, pl.zombie ? ctx.diff(296, 302, 310) : 285, 3.5);
      // humans dodge with a dash, zombies lunge
      if (f && s.btn.pressed(id, f) && now - pl.dashAt > (pl.zombie ? LUNGE_CD : DASH_CD)) {
        pl.dashAt = now;
        dash(pl.b, f, pl.zombie ? 380 : 430);
      }
      if (!pl.zombie) pl.survived += dt;
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.8, (a, b) => {
      const pa = s.p[a.id];
      const pb = s.p[b.id];
      if (pa.zombie === pb.zombie) return;
      const [z, h] = pa.zombie ? [a.id, b.id] : [b.id, a.id];
      if (now - s.p[z].turnedAt < TURN_MS + 400) return;
      s.p[h].zombie = true;
      s.p[h].turnedAt = now;
      s.p[z].infections++;
      s.fx.push({ x: r1(s.p[h].b.x), y: r1(s.p[h].b.y), at: now });
      ctx.event('infect', { id: h, by: z });
    });
    for (const id of ctx.ids) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, ZT.W, ZT.H, 0.5);
    }
    s.fx = s.fx.filter((f) => now - f.at < 800);
    const humans = ctx.ids.filter((id) => !s.p[id].zombie);
    if (humans.length <= 1 || now >= s.phaseEnds) endRound(s, ctx, humans);
  },
  pub(s, ctx) {
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      phaseEnds: s.phaseEnds,
      p: ctx.ids.map((id) => ({ id, x: r1(s.p[id].b.x), y: r1(s.p[id].b.y), z: s.p[id].zombie ? 1 : 0 })),
      fx: s.fx,
      humans: ctx.ids.filter((id) => !s.p[id].zombie).length,
      survivor: s.phase === 'break' ? s.survivor : null,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, scoreOf(s, id)])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (s.phase !== 'play') return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    if (me.zombie) {
      let target: Body | null = null;
      let bd = Infinity;
      for (const id of ctx.ids) {
        const o = s.p[id];
        if (o.zombie) continue;
        const d = dist(me.b, o.b);
        if (d < bd) {
          bd = d;
          target = o.b;
        }
      }
      if (!target) return { input: { x: 0, y: 0, b: 0 } };
      const inp = seek(me.b, target, (1 - skill) * 0.5);
      if (bd < 110 && now - me.dashAt > LUNGE_CD && Math.random() < skill * 0.35) inp.b = 1;
      return { input: inp };
    }
    // push away from nearby walls (corners are traps) without huddling in the middle
    const wall = (d: number) => (d < 150 ? ((150 - d) / 150) * 2.2 : 0);
    let fx = wall(me.b.x) - wall(ZT.W - me.b.x);
    let fy = wall(me.b.y) - wall(ZT.H - me.b.y);
    let close = Infinity;
    for (const id of ctx.ids) {
      const o = s.p[id];
      if (!o.zombie) continue;
      const d = dist(me.b, o.b) || 1;
      close = Math.min(close, d);
      if (d < 320) {
        fx += ((me.b.x - o.b.x) / d) * (320 - d) / 100;
        fy += ((me.b.y - o.b.y) / d) * (320 - d) / 100;
      }
    }
    const m = Math.hypot(fx, fy) || 1;
    return { input: { x: fx / m, y: fy / m, b: close < 90 && Math.random() < skill ? 1 : 0 } };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => scoreOf(s, id)));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const pl = s.p[id];
      perfs[id] = {
        score: scoreOf(s, id),
        perf: Math.min(1, scoreOf(s, id) / best),
        participated: ctx.acted(id),
        highlight: `survived ${pl.survived.toFixed(1)} s · ${pl.infections} infection${pl.infections === 1 ? '' : 's'}${pl.lastHuman ? ` · last human ${pl.lastHuman}×` : ''}`,
        bonuses: pl.lastHuman ? [{ label: 'Last human standing', pts: 40 }] : [],
      };
    }
    return { perfs };
  },
});

function scoreOf(s: S, id: string): number {
  const pl = s.p[id];
  return Math.round(pl.survived * 10) + pl.infections * 80 + pl.lastHuman * 250;
}

function startRound(s: S, ctx: GameCtx) {
  const first = s.firsts[s.round % s.firsts.length];
  const others = ctx.ids.filter((id) => id !== first);
  for (const id of ctx.ids) {
    const pl = s.p[id];
    pl.zombie = id === first;
    pl.turnedAt = 0;
    pl.dashAt = -99999;
    pl.b.vx = 0;
    pl.b.vy = 0;
  }
  s.p[first].b.x = ZT.W / 2;
  s.p[first].b.y = ZT.H / 2;
  others.forEach((id, i) => {
    const a = (i / others.length) * Math.PI * 2;
    s.p[id].b.x = ZT.W / 2 + Math.cos(a) * 380;
    s.p[id].b.y = ZT.H / 2 + Math.sin(a) * 280;
  });
  s.survivor = null;
  s.phase = 'count';
  s.phaseEnds = ctx.now() + COUNT_MS;
  ctx.dirty();
}

function endRound(s: S, ctx: GameCtx, humans: string[]) {
  s.survivor = humans.length === 1 ? humans[0] : null;
  if (s.survivor) s.p[s.survivor].lastHuman++;
  s.phase = 'break';
  s.phaseEnds = ctx.now() + BREAK_MS;
  ctx.event('round', { survivor: s.survivor });
  ctx.dirty();
}
