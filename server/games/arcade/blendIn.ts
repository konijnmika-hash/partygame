// Blend In: every Bloop on the field looks the same — most are wandering crowd Bloops. Collect
// gems without moving suspiciously, and STRIKE the Bloop you think is a real player.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, r1 } from '../../engine/arena';

export const BI = { W: 1000, H: 700, R: 22, SPEED: 95, STRIKE_R: 72 } as const;
const DURATION = 85_000;
const STRIKE_CD = 2500;
const STUN_MS = 2200;

interface Mob {
  key: string;
  pid: string | null;
  x: number;
  y: number;
  tx: number;
  ty: number;
  pauseUntil: number;
  stunUntil: number;
  revealUntil: number;
}

interface S {
  t0: number;
  endsAt: number;
  mobs: Mob[];
  byPid: Record<string, Mob>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  strikeAt: Record<string, number>;
  gems: { id: number; x: number; y: number }[];
  seq: number;
  pickups: { x: number; y: number; at: number; key: string }[];
  gemsGot: Record<string, number>;
  hits: Record<string, number>;
  hitBy: Record<string, number>;
  oops: Record<string, number>;
  fx: { k: 'hit' | 'oops' | 'gem'; x: number; y: number; at: number }[];
}

export const blendIn = defineGame<S>({
  id: 'blend-in',
  realtime: true,
  botDelay: [150, 300],
  setup(ctx) {
    const crowd = 26 + ctx.ids.length * 2;
    const total = crowd + ctx.ids.length;
    const keys = ctx.rng.shuffle(Array.from({ length: total }, (_, i) => `b${i + 1}`));
    const mobs: Mob[] = [];
    const byPid: Record<string, Mob> = {};
    for (let i = 0; i < total; i++) {
      const pid = i < ctx.ids.length ? ctx.ids[i] : null;
      const m: Mob = { key: keys[i], pid, x: 60 + ctx.rng.next() * (BI.W - 120), y: 60 + ctx.rng.next() * (BI.H - 120), tx: 0, ty: 0, pauseUntil: 0, stunUntil: 0, revealUntil: 0 };
      m.tx = m.x;
      m.ty = m.y;
      mobs.push(m);
      if (pid) byPid[pid] = m;
    }
    // shuffle draw order so list position doesn't give players away
    return { t0: 0, endsAt: 0, mobs: ctx.rng.shuffle(mobs), byPid, inputs: {}, btn: new Buttons(), strikeAt: {}, gems: [], seq: 0, pickups: [], gemsGot: Object.fromEntries(ctx.ids.map((id) => [id, 0])), hits: Object.fromEntries(ctx.ids.map((id) => [id, 0])), hitBy: Object.fromEntries(ctx.ids.map((id) => [id, 0])), oops: Object.fromEntries(ctx.ids.map((id) => [id, 0])), fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 1500;
    s.endsAt = s.t0 + ctx.ms(DURATION);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return ctx.end();
    while (s.gems.length < 4) s.gems.push({ id: ++s.seq, x: Math.round(60 + ctx.rng.next() * (BI.W - 120)), y: Math.round(60 + ctx.rng.next() * (BI.H - 120)) });
    for (const m of s.mobs) {
      if (m.stunUntil > now) continue;
      if (m.pid) {
        // players move at exactly crowd speed — the trick is moving like the crowd does
        const f = s.inputs[m.pid];
        const ix = f?.x ?? 0;
        const iy = f?.y ?? 0;
        const mag = Math.hypot(ix, iy);
        if (mag > 0.2) {
          m.x += (ix / mag) * BI.SPEED * dt;
          m.y += (iy / mag) * BI.SPEED * dt;
        }
        if (f && s.btn.pressed(m.pid, f) && now - (s.strikeAt[m.pid] ?? 0) > STRIKE_CD) strike(s, ctx, m);
      } else {
        // crowd Bloops walk to a spot, pause, pick another
        if (now < m.pauseUntil) continue;
        const dx = m.tx - m.x;
        const dy = m.ty - m.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) {
          m.pauseUntil = now + ctx.rng.int(400, 2200);
          m.tx = Math.max(40, Math.min(BI.W - 40, m.x + (ctx.rng.next() - 0.5) * 420));
          m.ty = Math.max(40, Math.min(BI.H - 40, m.y + (ctx.rng.next() - 0.5) * 320));
        } else {
          m.x += (dx / d) * BI.SPEED * dt;
          m.y += (dy / d) * BI.SPEED * dt;
        }
      }
      m.x = Math.max(BI.R, Math.min(BI.W - BI.R, m.x));
      m.y = Math.max(BI.R, Math.min(BI.H - BI.R, m.y));
      if (m.pid) {
        for (const g of s.gems) {
          if (g.x >= 0 && Math.hypot(g.x - m.x, g.y - m.y) < BI.R + 14) {
            s.gemsGot[m.pid]++;
            s.pickups.push({ x: g.x, y: g.y, at: now, key: m.key });
            s.fx.push({ k: 'gem', x: g.x, y: g.y, at: now });
            g.x = -1;
          }
        }
      }
    }
    s.gems = s.gems.filter((g) => g.x >= 0);
    s.pickups = s.pickups.filter((p) => now - p.at < 4000);
    s.fx = s.fx.filter((f) => now - f.at < 900);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      // nothing here tells crowd and players apart (except a brief reveal after a bad strike)
      p: s.mobs.map((m) => ({ id: m.key, x: r1(m.x), y: r1(m.y), st: m.stunUntil > now ? 1 : 0, rv: m.revealUntil > now ? 1 : 0 })),
      gems: s.gems.map((g) => [g.x, g.y]),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, score(s, id)])),
    };
  },
  priv(s, _ctx, pid) {
    return { me: s.byPid[pid]?.key ?? null, cd: s.strikeAt[pid] ?? 0 };
  },
  bot(s, ctx, pid) {
    const me = s.byPid[pid];
    const now = ctx.now();
    if (!me || now < s.t0 || me.stunUntil > now) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.45, 0.65, 0.85);
    // suspicious Bloop: someone who just picked up a gem nearby
    if (now - (s.strikeAt[pid] ?? 0) > STRIKE_CD) {
      for (const pk of s.pickups) {
        if (pk.key === me.key || now - pk.at > 2500) continue;
        const sus = s.mobs.find((m) => m.key === pk.key);
        if (!sus) continue;
        const d = Math.hypot(sus.x - me.x, sus.y - me.y);
        if (d < BI.STRIKE_R - 8 && Math.random() < skill * 0.6) return { input: { x: 0, y: 0, b: 1 } };
        if (d < 260 && Math.random() < skill) return { input: step(me, sus.x, sus.y) };
      }
    }
    // otherwise drift toward a gem with crowd-like walk/pause rhythm
    if (now < me.pauseUntil) return { input: { x: 0, y: 0, b: 0 } };
    let gem = s.gems[0];
    let bd = Infinity;
    for (const g of s.gems) {
      const d = Math.hypot(g.x - me.x, g.y - me.y);
      if (d < bd) {
        bd = d;
        gem = g;
      }
    }
    if (Math.random() < 0.08) me.pauseUntil = now + 500 + Math.random() * 1200;
    return { input: gem ? step(me, gem.x, gem.y) : { x: 0, y: 0, b: 0 } };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => score(s, id)));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = {
        score: score(s, id),
        perf: Math.min(1, score(s, id) / best),
        participated: ctx.acted(id),
        highlight: `💎 ${s.gemsGot[id]} · 🎯 ${s.hits[id]} player${s.hits[id] === 1 ? '' : 's'} spotted · caught ${s.hitBy[id]}× · ${s.oops[id]} wrong strike${s.oops[id] === 1 ? '' : 's'}`,
        bonuses: s.hitBy[id] === 0 && s.gemsGot[id] > 0 ? [{ label: 'Master of disguise', pts: 35 }] : [],
      };
    }
    return { perfs };
  },
});

function score(s: S, id: string): number {
  return Math.max(0, s.gemsGot[id] * 25 + s.hits[id] * 100 - s.hitBy[id] * 40);
}

function step(me: Mob, x: number, y: number): InputFrame {
  const dx = x - me.x;
  const dy = y - me.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, b: 0 };
}

function strike(s: S, ctx: GameCtx, m: Mob) {
  const now = ctx.now();
  s.strikeAt[m.pid!] = now;
  let target: Mob | null = null;
  let bd: number = BI.STRIKE_R;
  for (const o of s.mobs) {
    if (o === m) continue;
    const d = Math.hypot(o.x - m.x, o.y - m.y);
    if (d < bd) {
      bd = d;
      target = o;
    }
  }
  if (!target) return;
  if (target.pid) {
    s.hits[m.pid!]++;
    s.hitBy[target.pid]++;
    target.stunUntil = now + 1200;
    target.revealUntil = now + 1200;
    // the caught player is moved somewhere else so they can hide again
    target.x = 60 + ctx.rng.next() * (BI.W - 120);
    target.y = 60 + ctx.rng.next() * (BI.H - 120);
    s.fx.push({ k: 'hit', x: r1(m.x), y: r1(m.y), at: now });
    ctx.event('caught', { by: m.pid, id: target.pid });
  } else {
    s.oops[m.pid!]++;
    m.stunUntil = now + STUN_MS;
    m.revealUntil = now + STUN_MS;
    target.stunUntil = now + 800;
    s.fx.push({ k: 'oops', x: r1(m.x), y: r1(m.y), at: now });
    ctx.event('oops', { by: m.pid });
  }
}
