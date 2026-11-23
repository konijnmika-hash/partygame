// Team Survival: monsters roam the arena and knock Bloops down on contact. Stand next to a downed
// teammate to revive them. Team score is the average time your team stays on its feet.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { clampRect, collide, integrate, makeBody, r1, steer, type Body } from '../../engine/arena';
import { teamList, teamOf, teamResults } from '../../engine/teams';

export const TS = { W: 1000, H: 700, R: 25, MR: 28, REVIVE_R: 75, REVIVE_MS: 1200 } as const;
const DURATION = 75_000;

interface P { b: Body; down: boolean; downAt: number; revive: number; upTime: number; revives: number; downs: number }
interface Monster { id: number; x: number; y: number; vx: number; vy: number; sp: number; target: string | null; retarget: number }

interface S {
  teams: string[][];
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  mons: Monster[];
  seq: number;
  nextSpawn: number;
  fx: { k: 'down' | 'up'; x: number; y: number; at: number }[];
}

export const teamSurvival = defineGame<S>({
  id: 'team-survival',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const teams = teamList(ctx);
    const p: Record<string, P> = {};
    teams.forEach((members, t) => {
      const cx = TS.W * ((t + 1) / (teams.length + 1));
      members.forEach((id, i) => {
        p[id] = { b: makeBody(id, cx + (i % 2) * 50 - 25, TS.H / 2 + (i - members.length / 2) * 55, TS.R), down: false, downAt: 0, revive: 0, upTime: 0, revives: 0, downs: 0 };
      });
    });
    return { teams, t0: 0, endsAt: 0, p, inputs: {}, mons: [], seq: 0, nextSpawn: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1500;
    s.endsAt = s.t0 + ctx.ms(DURATION);
    s.nextSpawn = s.t0;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return ctx.end();
    const frac = (now - s.t0) / ctx.ms(DURATION);
    const want = Math.round(ctx.diff(2, 3, 4) + frac * ctx.diff(4, 6, 8) + ctx.ids.length / 4);
    if (s.mons.length < want && now >= s.nextSpawn) {
      const side = ctx.rng.int(0, 3);
      const x = side === 0 ? -20 : side === 1 ? TS.W + 20 : ctx.rng.next() * TS.W;
      const y = side === 2 ? -20 : side === 3 ? TS.H + 20 : ctx.rng.next() * TS.H;
      s.mons.push({ id: ++s.seq, x, y, vx: 0, vy: 0, sp: ctx.diff(120, 142, 168) * (0.85 + ctx.rng.next() * 0.3), target: null, retarget: 0 });
      s.nextSpawn = now + 1800;
    }
    const standing = ctx.ids.filter((id) => !s.p[id].down);
    for (const id of standing) {
      steer(s.p[id].b, s.inputs[id], dt, 1600, 300, 3.6);
      s.p[id].upTime += dt;
    }
    for (const id of ctx.ids) if (s.p[id].down) {
      s.p[id].b.vx = 0;
      s.p[id].b.vy = 0;
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.6);
    for (const id of ctx.ids) {
      integrate(s.p[id].b, dt);
      clampRect(s.p[id].b, 0, 0, TS.W, TS.H, 0.4);
    }
    // monsters chase the nearest standing Bloop (re-targeting now and then)
    for (const m of s.mons) {
      if (now >= m.retarget || !m.target || s.p[m.target]?.down) {
        let best: string | null = null;
        let bd = Infinity;
        for (const id of standing) {
          const d = Math.hypot(s.p[id].b.x - m.x, s.p[id].b.y - m.y);
          if (d < bd) {
            bd = d;
            best = id;
          }
        }
        m.target = best;
        m.retarget = now + 1500 + ctx.rng.int(0, 1200);
      }
      let tx = TS.W / 2;
      let ty = TS.H / 2;
      if (m.target) {
        tx = s.p[m.target].b.x;
        ty = s.p[m.target].b.y;
      }
      const dx = tx - m.x;
      const dy = ty - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.vx += ((dx / d) * m.sp - m.vx) * Math.min(1, dt * 2.5);
      m.vy += ((dy / d) * m.sp - m.vy) * Math.min(1, dt * 2.5);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      for (const id of standing) {
        const pl = s.p[id];
        if (!pl.down && Math.hypot(pl.b.x - m.x, pl.b.y - m.y) < TS.R + TS.MR - 6) {
          pl.down = true;
          pl.downAt = now;
          pl.revive = 0;
          pl.downs++;
          s.fx.push({ k: 'down', x: r1(pl.b.x), y: r1(pl.b.y), at: now });
          ctx.event('down', { id });
          // the monster bounces off
          m.vx = -m.vx * 1.5;
          m.vy = -m.vy * 1.5;
          m.retarget = now;
        }
      }
    }
    // revives: a standing teammate nearby fills the revive meter
    for (const id of ctx.ids) {
      const pl = s.p[id];
      if (!pl.down) continue;
      const t = teamOf(ctx, id);
      const helper = s.teams[t].find((o) => o !== id && !s.p[o].down && Math.hypot(s.p[o].b.x - pl.b.x, s.p[o].b.y - pl.b.y) < TS.REVIVE_R);
      if (helper) {
        pl.revive += dt * 1000;
        if (pl.revive >= TS.REVIVE_MS) {
          pl.down = false;
          pl.revive = 0;
          s.p[helper].revives++;
          s.fx.push({ k: 'up', x: r1(pl.b.x), y: r1(pl.b.y), at: now });
          ctx.event('revive', { id, by: helper });
        }
      } else pl.revive = Math.max(0, pl.revive - dt * 500);
    }
    s.fx = s.fx.filter((f) => now - f.at < 800);
    // everyone down: the game ends early
    if (ctx.ids.every((id) => s.p[id].down)) ctx.end();
  },
  pub(s, ctx) {
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      teams: s.teams,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), dn: pl.down ? 1 : 0, rv: pl.down ? Math.round((pl.revive / TS.REVIVE_MS) * 100) / 100 : 0 };
      }),
      o: s.mons.map((m) => ({ id: m.id, x: r1(m.x), y: r1(m.y) })),
      fx: s.fx,
      teamUp: s.teams.map((m) => Math.round(m.reduce((a, id) => a + s.p[id].upTime, 0) / Math.max(1, m.length))),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    if (me.down || ctx.now() < s.t0) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.7, 0.9);
    const b = me.b;
    let fx = 0;
    let fy = 0;
    let danger = 0;
    for (const m of s.mons) {
      const d = Math.hypot(b.x - m.x, b.y - m.y);
      if (d < 230) {
        const k = ((230 - d) / 230) * 2.2 * (0.5 + skill);
        fx += ((b.x - m.x) / (d || 1)) * k;
        fy += ((b.y - m.y) / (d || 1)) * k;
        danger = Math.max(danger, 230 - d);
      }
    }
    // go revive a downed teammate when it is reasonably safe
    const t = teamOf(ctx, pid);
    if (danger < 120) {
      const downed = s.teams[t].filter((o) => o !== pid && s.p[o].down);
      if (downed.length) {
        const o = s.p[downed[0]].b;
        const d = Math.hypot(o.x - b.x, o.y - b.y) || 1;
        fx += ((o.x - b.x) / d) * (d > 40 ? 1.4 : 0);
        fy += ((o.y - b.y) / d) * (d > 40 ? 1.4 : 0);
      }
    }
    // avoid walls
    fx += (TS.W / 2 - b.x) / 900;
    fy += (TS.H / 2 - b.y) / 700;
    const m = Math.hypot(fx, fy);
    if (m < 0.05) return { input: { x: 0, y: 0, b: 0 } };
    return { input: { x: fx / Math.max(1, m), y: fy / Math.max(1, m), b: 0 } };
  },
  results(s, ctx) {
    const scores = s.teams.map((m) => m.reduce((a, id) => a + s.p[id].upTime, 0) / Math.max(1, m.length) + m.reduce((a, id) => a + s.p[id].revives, 0) * 3);
    return teamResults(ctx, scores, {
      great: DURATION / 1000,
      individual: Object.fromEntries(ctx.ids.map((id) => [id, Math.round(s.p[id].upTime * 10) + s.p[id].revives * 30])),
      highlight: (id) => `On your feet ${s.p[id].upTime.toFixed(0)} s · ${s.p[id].revives} revive${s.p[id].revives === 1 ? '' : 's'} · knocked down ${s.p[id].downs}×`,
      bonuses: (id) => (s.p[id].revives >= 3 ? [{ label: 'Medic', pts: 30 }] : []),
    });
  },
});

