// Pipe Panic: a single-screen platform brawl. Critters crawl out of the pipes at the top and
// walk down the ledges. Jump up and bonk the ledge under a critter to flip it on its back, then
// run into it to kick it away for points. Upright critters bump you. The POW block flips every
// critter on the screen at once. Coins pop out of the pipes after every kick.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, r1 } from '../../engine/arena';

export const PP = { W: 1000, H: 600, HW: 15, HH: 20, CR: 18 } as const;
const DURATION = 80_000;
const GRAV = 1900;
const JUMP_V = 830;
const RUN = 270;
const FLIP_MS = 5200;
const POW = { x: 500, y: 445, w: 46, h: 36 };

interface Plat { x0: number; x1: number; y: number }
/** y = top surface; every ledge is 16 px thick and solid from below (that's how you bonk). */
export const PLATS: Plat[] = [
  { x0: 0, x1: 360, y: 430 },
  { x0: 640, x1: 1000, y: 430 },
  { x0: 240, x1: 760, y: 310 },
  { x0: 0, x1: 400, y: 190 },
  { x0: 600, x1: 1000, y: 190 },
];
const FLOOR = 560;
const THICK = 16;

interface Ent { x: number; y: number; vx: number; vy: number; ground: number } // ground: -1 air, 0..n plat, 99 floor
interface P extends Ent { id: string; face: 1 | -1; pts: number; kicks: number; coins: number; bonks: number; stunUntil: number; invulnUntil: number; upWas: boolean }
interface Critter extends Ent { id: number; kind: 0 | 1; dir: 1 | -1; flipUntil: number; mad: number }
interface Coin extends Ent { id: number; dir: 1 | -1 }

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  critters: Critter[];
  coins: Coin[];
  seq: number;
  spawnAt: number;
  pipe: number;
  bumps: { x: number; y: number; at: number }[];
  pow: number;
  powRefill: number;
  powHit: number;
  fx: { x: number; y: number; at: number; k: string }[];
  botJ: Record<string, boolean>;
}

function wrapX(x: number) {
  return x < 0 ? x + PP.W : x >= PP.W ? x - PP.W : x;
}

/** Land an entity on the floor or a ledge after it moved; returns the surface index or -1. */
function land(e: Ent, prevFeet: number, hh: number): number {
  const feet = e.y + hh;
  if (e.vy < 0) return -1;
  if (prevFeet <= FLOOR + 1 && feet >= FLOOR) {
    e.y = FLOOR - hh;
    e.vy = 0;
    return 99;
  }
  for (let i = 0; i < PLATS.length; i++) {
    const pl = PLATS[i];
    if (e.x >= pl.x0 - 4 && e.x <= pl.x1 + 4 && prevFeet <= pl.y + 1 && feet >= pl.y) {
      e.y = pl.y - hh;
      e.vy = 0;
      return i;
    }
  }
  return -1;
}

function onSurface(e: Ent, hh: number): number {
  if (Math.abs(e.y + hh - FLOOR) < 1) return 99;
  for (let i = 0; i < PLATS.length; i++) {
    const pl = PLATS[i];
    if (Math.abs(e.y + hh - pl.y) < 1 && e.x >= pl.x0 - 4 && e.x <= pl.x1 + 4) return i;
  }
  return -1;
}

function spawnFromPipe(s: S, kind: 'critter' | 'coin', rnd: () => number) {
  const left = s.pipe++ % 2 === 0;
  const x = left ? 50 : PP.W - 50;
  const dir: 1 | -1 = left ? 1 : -1;
  if (kind === 'coin') s.coins.push({ id: ++s.seq, x, y: 150, vx: 0, vy: 0, ground: -1, dir });
  else s.critters.push({ id: ++s.seq, x, y: 150, vx: 0, vy: 0, ground: -1, kind: rnd() < 0.35 ? 1 : 0, dir, flipUntil: 0, mad: 0 });
}

function walk(e: Ent & { dir: 1 | -1 }, speed: number, hh: number, dt: number) {
  e.vy = Math.min(900, e.vy + GRAV * dt);
  e.vx = e.ground >= 0 ? e.dir * speed : e.vx;
  const prevFeet = e.y + hh;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.ground = land(e, prevFeet, hh);
  if (e.ground < 0 && e.vy === 0) e.ground = onSurface(e, hh);
  if (e.ground >= 0 && e.ground !== 99 && onSurface(e, hh) < 0) e.ground = -1;
  if (e.ground < 0 && e.vy === 0) e.vy = 1;
}

export const pipePanic = defineGame<S>({
  id: 'pipe-panic',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const x = 80 + ((PP.W - 160) * (n === 1 ? 0.5 : i / (n - 1)));
      p[id] = { id, x, y: FLOOR - PP.HH, vx: 0, vy: 0, ground: 99, face: x < 500 ? 1 : -1, pts: 0, kicks: 0, coins: 0, bonks: 0, stunUntil: 0, invulnUntil: 0, upWas: false };
    });
    return { t0: 0, endsAt: 0, p, inputs: {}, btn: new Buttons(), critters: [], coins: [], seq: 0, spawnAt: 0, pipe: 0, bumps: [], pow: 3, powRefill: 0, powHit: 0, fx: [], botJ: {} };
  },
  start(s, ctx) {
    s.t0 = ctx.now();
    s.endsAt = s.t0 + ctx.ms(DURATION);
    s.spawnAt = s.t0 + 800;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    const want = Math.min(9, 3 + Math.ceil(ctx.ids.length / 2) + Math.floor((now - s.t0) / 25000));
    if (now >= s.spawnAt && s.critters.length < want) {
      spawnFromPipe(s, 'critter', () => ctx.rng.next());
      s.spawnAt = now + ctx.diff(2600, 2000, 1500);
    }
    if (s.pow < 3 && now >= s.powRefill) s.pow = 3;
    // players
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const f = s.inputs[id];
      const bPressed = s.btn.pressed(id, f, 2) || s.btn.pressed(id, f, 1);
      const stunned = now < pl.stunUntil;
      const ix = stunned ? 0 : (f?.x ?? 0);
      const up = !stunned && (f?.y ?? 0) < -0.55;
      const jump = !stunned && (bPressed || (up && !pl.upWas));
      pl.upWas = up;
      if (Math.abs(ix) > 0.2) pl.face = ix > 0 ? 1 : -1;
      const accel = pl.ground >= 0 ? 2200 : 1100;
      pl.vx += ix * accel * dt;
      pl.vx *= Math.max(0, 1 - (pl.ground >= 0 && Math.abs(ix) < 0.2 ? 10 : 1.5) * dt);
      pl.vx = Math.max(-RUN, Math.min(RUN, pl.vx));
      if (jump && pl.ground >= 0) {
        pl.vy = -JUMP_V;
        pl.ground = -1;
        ctx.event('jump', { id });
      }
      pl.vy = Math.min(900, pl.vy + GRAV * dt);
      const prevFeet = pl.y + PP.HH;
      const prevHead = pl.y - PP.HH;
      pl.x = wrapX(pl.x + pl.vx * dt);
      pl.y += pl.vy * dt;
      // head bonks on ledges and the POW block
      if (pl.vy < 0) {
        const head = pl.y - PP.HH;
        for (let i = 0; i < PLATS.length; i++) {
          const pf = PLATS[i];
          const bottom = pf.y + THICK;
          if (pl.x >= pf.x0 && pl.x <= pf.x1 && prevHead >= bottom - 1 && head < bottom) {
            pl.y = bottom + PP.HH;
            pl.vy = 60;
            bump(s, ctx, i, pl.x, now, id);
            break;
          }
        }
        if (pl.vy < 0 && Math.abs(pl.x - POW.x) < POW.w / 2 + 6 && prevHead >= POW.y + POW.h / 2 - 1 && head < POW.y + POW.h / 2) {
          pl.y = POW.y + POW.h / 2 + PP.HH;
          pl.vy = 60;
          if (s.pow > 0) powBlast(s, ctx, now, id);
        }
      }
      const g = land(pl, prevFeet, PP.HH);
      pl.ground = g >= 0 ? g : pl.vy === 0 ? onSurface(pl, PP.HH) : -1;
      if (pl.ground >= 0 && pl.ground !== 99 && onSurface(pl, PP.HH) < 0) pl.ground = -1;
      if (pl.ground < 0 && pl.vy === 0) pl.vy = 1;
      if (pl.y > PP.H + 40) {
        pl.y = FLOOR - PP.HH;
        pl.vy = 0;
      }
    }
    // critters
    for (const c of s.critters) {
      const flipped = now < c.flipUntil;
      if (c.flipUntil && !flipped) {
        c.flipUntil = 0;
        c.mad++;
        c.vy = -300;
        c.ground = -1;
      }
      const speed = flipped ? 0 : (c.kind === 1 ? 95 : 70) * (1 + c.mad * 0.35) * ctx.diff(0.85, 1, 1.2);
      walk(c, speed, PP.CR, dt);
      if (c.ground === 99 && (c.x < 30 || c.x > PP.W - 30)) {
        // back into a bottom pipe -> out of a top pipe
        const left = c.x > 500;
        c.x = left ? 50 : PP.W - 50;
        c.y = 150;
        c.dir = left ? 1 : -1;
        c.ground = -1;
        c.vy = 0;
      }
      c.x = wrapX(c.x);
    }
    for (const c of s.coins) {
      walk(c, 120, 12, dt);
      if (c.ground === 99 && (c.x < 30 || c.x > PP.W - 30)) c.id = -1;
      c.x = wrapX(c.x);
    }
    // contacts
    for (const id of ctx.ids) {
      const pl = s.p[id];
      for (const c of s.critters) {
        if (c.id < 0) continue;
        if (Math.abs(c.x - pl.x) > PP.HW + PP.CR - 4 || Math.abs(c.y - pl.y) > PP.HH + PP.CR - 6) continue;
        if (now < c.flipUntil) {
          c.id = -1;
          pl.kicks++;
          pl.pts += 100 + c.mad * 50;
          s.fx.push({ x: r1(c.x), y: r1(c.y), at: now, k: `+${100 + c.mad * 50}` });
          ctx.event('kick', { id, kind: c.kind });
          if (ctx.rng.next() < 0.7) spawnFromPipe(s, 'coin', () => ctx.rng.next());
        } else if (now > pl.invulnUntil && now > pl.stunUntil) {
          pl.bonks++;
          pl.pts = Math.max(0, pl.pts - 60);
          pl.stunUntil = now + 900;
          pl.invulnUntil = now + 2400;
          pl.vx = (pl.x < c.x ? -1 : 1) * 260;
          pl.vy = -380;
          pl.ground = -1;
          s.fx.push({ x: r1(pl.x), y: r1(pl.y), at: now, k: '-60' });
          ctx.event('bonk', { id });
        }
      }
      for (const c of s.coins) {
        if (c.id < 0 || Math.abs(c.x - pl.x) > 28 || Math.abs(c.y - pl.y) > 30) continue;
        c.id = -1;
        pl.coins++;
        pl.pts += 50;
        s.fx.push({ x: r1(c.x), y: r1(c.y), at: now, k: '+50' });
        ctx.event('coin', { id });
      }
    }
    s.critters = s.critters.filter((c) => c.id > 0);
    s.coins = s.coins.filter((c) => c.id > 0);
    s.bumps = s.bumps.filter((b) => now - b.at < 220);
    s.fx = s.fx.filter((f) => now - f.at < 800);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      pow: s.pow,
      powHit: s.powHit,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.x), y: r1(pl.y), f: pl.face, st: now < pl.stunUntil ? 1 : 0, inv: now < pl.invulnUntil ? 1 : 0, g: pl.ground >= 0 ? 1 : 0 };
      }),
      o: s.critters.map((c) => ({ id: c.id, x: r1(c.x), y: r1(c.y), k: c.kind, d: c.dir, fl: now < c.flipUntil ? Math.ceil((c.flipUntil - now) / 1000) : 0, m: c.mad })),
      c: s.coins.map((c) => ({ id: c.id, x: r1(c.x), y: r1(c.y) })),
      bumps: s.bumps,
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].pts])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    if (now < me.stunUntil) return { input: { x: 0, y: 0, b: 0 } };
    const skill = ctx.diff(0.4, 0.65, 0.9);
    const lastJ = s.botJ[pid];
    s.botJ[pid] = false;
    const jb = () => {
      if (lastJ || me.ground < 0) return 0;
      s.botJ[pid] = true;
      return 2;
    };
    const feet = me.y + PP.HH;
    // dodge an upright critter walking at me on my level
    for (const c of s.critters) {
      if (now < c.flipUntil) continue;
      if (Math.abs(c.y + PP.CR - feet) < 8 && Math.abs(c.x - me.x) < 90 && Math.sign(me.x - c.x) === c.dir && ctx.rng.next() < skill) {
        return { input: { x: Math.sign(me.x - c.x) || 1, y: 0, b: jb() } };
      }
    }
    // kick a flipped critter on my level
    let best: { x: number; score: number; jump: boolean } | null = null;
    for (const c of s.critters) {
      const cf = c.y + PP.CR;
      const dx = c.x - me.x;
      if (now < c.flipUntil && Math.abs(cf - feet) < 8) {
        const sc = 1000 - Math.abs(dx);
        if (!best || sc > best.score) best = { x: c.x, score: sc, jump: false };
      } else if (now >= c.flipUntil && c.ground >= 0 && c.ground !== 99) {
        // a critter standing on the ledge right above my head: bonk it
        const pf = PLATS[c.ground];
        const gap = pf.y + THICK - (me.y - PP.HH);
        if (gap < 0 && gap > -150 && me.x >= pf.x0 && me.x <= pf.x1) {
          const sc = 600 - Math.abs(dx);
          if (!best || sc > best.score) best = { x: c.x, score: sc, jump: Math.abs(dx) < 30 };
        }
      }
    }
    for (const c of s.coins) {
      if (Math.abs(c.y + 12 - feet) < 10) {
        const sc = 500 - Math.abs(c.x - me.x);
        if (!best || sc > best.score) best = { x: c.x, score: sc, jump: false };
      }
    }
    if (best) {
      const dx = best.x - me.x;
      return { input: { x: Math.abs(dx) < 12 ? 0 : Math.sign(dx), y: 0, b: best.jump ? jb() : 0 } };
    }
    // wander and hop between levels; punch the POW block now and then
    const t = Math.floor(now / 2500 + pid.length) % 3;
    const targetX = t === 0 ? 180 : t === 1 ? 820 : 500;
    const dx = targetX - me.x;
    const nearPow = Math.abs(me.x - POW.x) < 20 && me.ground === 99 && s.pow > 0 && s.critters.length >= 4;
    return { input: { x: Math.abs(dx) < 20 ? 0 : Math.sign(dx), y: 0, b: nearPow || ctx.rng.next() < 0.08 ? jb() : 0 } };
  },
  results(s, ctx) {
    const best = Math.max(1, ...ctx.ids.map((id) => s.p[id].pts));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const pl = s.p[id];
      perfs[id] = {
        score: pl.pts,
        perf: Math.min(1, pl.pts / best),
        participated: ctx.acted(id),
        highlight: `${pl.pts} pts · ${pl.kicks} kick${pl.kicks === 1 ? '' : 's'} · ${pl.coins} coin${pl.coins === 1 ? '' : 's'} · bumped ${pl.bonks}×`,
        bonuses: pl.bonks === 0 && pl.kicks >= 2 ? [{ label: 'Untouchable', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});

function bump(s: S, ctx: { ids: string[]; event(t: string, d?: unknown): void }, plat: number, x: number, now: number, by: string) {
  const pf = PLATS[plat];
  s.bumps.push({ x: r1(x), y: pf.y, at: now });
  ctx.event('bump', { id: by });
  for (const c of s.critters) {
    if (c.ground !== plat || Math.abs(c.x - x) > 48) continue;
    if (now < c.flipUntil) c.flipUntil = 0; // bonk again: it flips back over!
    else c.flipUntil = now + FLIP_MS;
    c.vy = -260;
    c.ground = -1;
    s.p[by].pts += 10;
  }
  for (const c of s.coins) {
    if (c.ground !== plat || Math.abs(c.x - x) > 48) continue;
    c.id = -1;
    s.p[by].coins++;
    s.p[by].pts += 50;
    ctx.event('coin', { id: by });
  }
  for (const id of ctx.ids) {
    const o = s.p[id];
    if (o.ground === plat && Math.abs(o.x - x) < 48) {
      o.vy = -330;
      o.ground = -1;
    }
  }
}

function powBlast(s: S, ctx: { event(t: string, d?: unknown): void }, now: number, by: string) {
  s.pow--;
  s.powHit = now;
  if (s.pow === 0) s.powRefill = now + 18_000;
  let n = 0;
  for (const c of s.critters) {
    if (c.ground < 0) continue;
    c.flipUntil = now < c.flipUntil ? 0 : now + FLIP_MS;
    c.vy = -260;
    c.ground = -1;
    n++;
  }
  s.p[by].pts += n * 10;
  ctx.event('pow', { id: by, n });
}
