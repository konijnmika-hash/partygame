// Knockout Clash: a side-view platform fighter. Every hit raises the target's damage percentage,
// and the higher it gets, the further the next hit launches them. Knock rivals past the edges of
// the screen to take a stock. Three stocks each; last Bloop on the stage wins.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, r1 } from '../../engine/arena';

export const KC = { W: 1000, H: 600, HW: 18, HH: 22 } as const;
const DURATION = 100_000;
const STOCKS = 3;
const GRAV = 2000;
const MAX_FALL = 950;
const JUMP_V = 760;
const AIR_JUMP_V = 700;
const RUN = 340;
const RESPAWN_MS = 1100;
const INVULN_MS = 2000;
const ATTACK_CD = 300;
const SMASH_CD = 900;

/** main stage is a solid block; the others are pass-through ledges */
export const STAGE = { x0: 210, x1: 790, y: 430, y1: 490 };
export const LEDGES = [
  { x0: 290, x1: 430, y: 310 },
  { x0: 570, x1: 710, y: 310 },
  { x0: 430, x1: 570, y: 195 },
];

interface P {
  id: string;
  x: number; y: number; vx: number; vy: number;
  face: 1 | -1;
  ground: boolean;
  jumps: number;
  pct: number;
  stocks: number;
  stunUntil: number;
  invulnUntil: number;
  deadUntil: number;
  atkAt: number;
  atkKind: 0 | 1 | 2 | 3; // none, jab, up, smash
  dropUntil: number;
  upWas: boolean;
  lastHitBy: string | null;
  kos: number;
  falls: number;
  hits: number;
  out: boolean;
  outAt: number;
}

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  fx: { x: number; y: number; at: number; k: string }[];
  botJump: Record<string, boolean>;
}

function spawnX(i: number, n: number) {
  return STAGE.x0 + 60 + ((STAGE.x1 - STAGE.x0 - 120) * (n === 1 ? 0.5 : i / (n - 1)));
}

function alive(s: S, ids: string[]) {
  return ids.filter((id) => !s.p[id].out);
}

export const knockoutClash = defineGame<S>({
  id: 'knockout-clash',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      p[id] = {
        id, x: spawnX(i, n), y: STAGE.y - KC.HH, vx: 0, vy: 0, face: i < n / 2 ? 1 : -1, ground: true, jumps: 1, pct: 0, stocks: STOCKS,
        stunUntil: 0, invulnUntil: 0, deadUntil: 0, atkAt: -9999, atkKind: 0, dropUntil: 0, upWas: false, lastHitBy: null, kos: 0, falls: 0, hits: 0, out: false, outAt: 0,
      };
    });
    return { t0: 0, endsAt: 0, p, inputs: {}, btn: new Buttons(), fx: [], botJump: {} };
  },
  start(s, ctx) {
    s.t0 = ctx.now();
    s.endsAt = s.t0 + ctx.ms(DURATION);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt || (ctx.ids.length > 1 && alive(s, ctx.ids).length <= 1)) return ctx.end();
    for (const id of ctx.ids) {
      const pl = s.p[id];
      if (pl.out) continue;
      const f = s.inputs[id];
      const aPressed = s.btn.pressed(id, f, 1);
      const bPressed = s.btn.pressed(id, f, 2);
      if (pl.deadUntil) {
        if (now < pl.deadUntil) continue;
        pl.deadUntil = 0;
        pl.x = 500;
        pl.y = 90;
        pl.vx = 0;
        pl.vy = 0;
        pl.pct = 0;
        pl.jumps = 1;
        pl.invulnUntil = now + INVULN_MS;
        pl.lastHitBy = null;
      }
      const stunned = now < pl.stunUntil;
      const ix = stunned ? 0 : (f?.x ?? 0);
      const iy = stunned ? 0 : (f?.y ?? 0);
      const up = iy < -0.55;
      const jump = !stunned && (bPressed || (up && !pl.upWas));
      pl.upWas = up;
      if (Math.abs(ix) > 0.2) pl.face = ix > 0 ? 1 : -1;
      // horizontal movement
      const accel = pl.ground ? 2600 : 1500;
      pl.vx += ix * accel * dt;
      const fr = stunned ? 0.6 : pl.ground && Math.abs(ix) < 0.2 ? 12 : 2.2;
      pl.vx *= Math.max(0, 1 - fr * dt);
      if (!stunned && Math.abs(pl.vx) > RUN) pl.vx = Math.sign(pl.vx) * Math.max(RUN, Math.abs(pl.vx) * (1 - 6 * dt));
      // jumping
      if (jump) {
        if (pl.ground) {
          pl.vy = -JUMP_V;
          pl.ground = false;
          ctx.event('jump', { id });
        } else if (pl.jumps > 0) {
          pl.jumps--;
          pl.vy = -AIR_JUMP_V;
          ctx.event('jump', { id, air: 1 });
        }
      }
      if (!stunned && iy > 0.6 && pl.ground && pl.y + KC.HH < STAGE.y - 2) pl.dropUntil = now + 250;
      // attacks
      if (!stunned && aPressed) {
        const smash = pl.ground && Math.abs(ix) > 0.85 && now - pl.atkAt > SMASH_CD;
        if (smash || now - pl.atkAt > ATTACK_CD) {
          pl.atkAt = now;
          pl.atkKind = smash ? 3 : iy < -0.5 ? 2 : 1;
          strike(s, ctx, pl, now);
        }
      }
      // gravity + integrate
      pl.vy = Math.min(MAX_FALL, pl.vy + GRAV * dt * (stunned ? 0.8 : 1));
      const prevFeet = pl.y + KC.HH;
      const prevY = pl.y;
      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;
      pl.ground = false;
      const feet = pl.y + KC.HH;
      // solid stage block
      const overX = pl.x + KC.HW > STAGE.x0 && pl.x - KC.HW < STAGE.x1;
      if (overX && pl.vy >= 0 && prevFeet <= STAGE.y + 1 && feet >= STAGE.y) {
        pl.y = STAGE.y - KC.HH;
        pl.vy = 0;
        pl.ground = true;
      } else if (overX && pl.y + KC.HH > STAGE.y && pl.y - KC.HH < STAGE.y1) {
        if (prevY - KC.HH >= STAGE.y1 - 1 && pl.vy < 0) {
          pl.y = STAGE.y1 + KC.HH;
          pl.vy = 0;
        } else if (pl.x < (STAGE.x0 + STAGE.x1) / 2) {
          pl.x = STAGE.x0 - KC.HW;
          pl.vx = Math.min(0, pl.vx);
        } else {
          pl.x = STAGE.x1 + KC.HW;
          pl.vx = Math.max(0, pl.vx);
        }
      }
      if (!pl.ground && pl.vy >= 0 && now > pl.dropUntil) {
        for (const l of LEDGES) {
          if (pl.x > l.x0 - 6 && pl.x < l.x1 + 6 && prevFeet <= l.y + 1 && feet >= l.y) {
            pl.y = l.y - KC.HH;
            pl.vy = 0;
            pl.ground = true;
            break;
          }
        }
      }
      if (pl.ground) {
        pl.jumps = 1;
        if (now > pl.stunUntil) pl.lastHitBy = pl.lastHitBy && now - pl.stunUntil > 2500 ? null : pl.lastHitBy;
      }
      // blast zones
      if (pl.x < -130 || pl.x > KC.W + 130 || pl.y > KC.H + 140 || pl.y < -280) {
        pl.stocks--;
        pl.falls++;
        const by = pl.lastHitBy;
        if (by && s.p[by]) s.p[by].kos++;
        s.fx.push({ x: r1(Math.max(20, Math.min(KC.W - 20, pl.x))), y: r1(Math.max(20, Math.min(KC.H - 20, pl.y))), at: now, k: 'ko' });
        ctx.event('ko', { id, by, left: pl.stocks });
        if (pl.stocks <= 0) {
          pl.out = true;
          pl.outAt = now;
        } else pl.deadUntil = now + RESPAWN_MS;
        pl.x = 500;
        pl.y = -200;
        pl.vx = 0;
        pl.vy = 0;
      }
    }
    s.fx = s.fx.filter((f) => now - f.at < 700);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        const gone = pl.out || pl.deadUntil > 0;
        return {
          id, x: r1(pl.x), y: r1(pl.y), f: pl.face, pct: Math.round(pl.pct), st: pl.stocks, g: gone ? 1 : 0,
          a: now - pl.atkAt < 160 ? pl.atkKind : 0, hs: now < pl.stunUntil ? 1 : 0, inv: now < pl.invulnUntil ? 1 : 0, gr: pl.ground ? 1 : 0,
        };
      }),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].kos])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    if (me.out || me.deadUntil) return null;
    const now = ctx.now();
    const skill = ctx.diff(0.35, 0.6, 0.85);
    const lastJ = s.botJump[pid];
    s.botJump[pid] = false;
    const jumpBit = () => {
      if (lastJ) return 0;
      s.botJump[pid] = true;
      return 2;
    };
    // recovery: get back over the stage
    const off = me.x < STAGE.x0 - 4 || me.x > STAGE.x1 + 4;
    if (off && !me.ground) {
      const dir = me.x < 500 ? 1 : -1;
      const b = (me.y > STAGE.y - 60 || me.vy > 200) && me.jumps > 0 ? jumpBit() : 0;
      return { input: { x: dir, y: 0, b } };
    }
    let target: P | null = null;
    let td = Infinity;
    for (const id of ctx.ids) {
      const o = s.p[id];
      if (id === pid || o.out || o.deadUntil) continue;
      const d = Math.hypot(o.x - me.x, (o.y - me.y) * 1.5);
      if (d < td) {
        td = d;
        target = o;
      }
    }
    if (!target) return { input: { x: (500 - me.x) / 300, y: 0, b: 0 } };
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    let x = Math.abs(dx) > 40 ? Math.sign(dx) : 0;
    // don't run off the edge chasing someone who is off stage
    if ((me.x < STAGE.x0 + 30 && x < 0) || (me.x > STAGE.x1 - 30 && x > 0)) x = 0;
    let b = 0;
    let y = 0;
    if (dy < -70 && me.ground && ctx.rng.next() < 0.5) b = jumpBit();
    if (Math.abs(dx) < 70 && Math.abs(dy) < 55 && now - me.atkAt > ATTACK_CD && ctx.rng.next() < skill) {
      b |= 1;
      if (Math.abs(dy) > 30 && dy < 0) y = -0.7;
      else if (target.pct > 70 && me.ground && ctx.rng.next() < skill) x = Math.sign(dx);
      else if (Math.abs(dx) < 70) x = Math.sign(dx) * 0.5;
    }
    if (me.ground && ctx.rng.next() < 0.02) b |= jumpBit();
    return { input: { x, y, b } };
  },
  results(s, ctx) {
    const ranked = [...ctx.ids].sort((a, b) => {
      const A = s.p[a], B = s.p[b];
      if (A.out !== B.out) return A.out ? 1 : -1;
      if (A.out && B.out) return B.outAt - A.outAt;
      if (A.stocks !== B.stocks) return B.stocks - A.stocks;
      return A.pct - B.pct;
    });
    const n = ctx.ids.length;
    const perfs: Record<string, any> = {};
    ranked.forEach((id, i) => {
      const pl = s.p[id];
      perfs[id] = {
        score: (n - i) * 100 + pl.kos * 40 - pl.falls * 5,
        perf: Math.min(1, ((n - 1 - i) / Math.max(1, n - 1)) * 0.6 + Math.min(1, pl.kos / 3) * 0.4),
        participated: ctx.acted(id),
        highlight: `${i === 0 ? '🏆 ' : `#${i + 1} · `}${pl.kos} KO${pl.kos === 1 ? '' : 's'} · ${pl.stocks} stock${pl.stocks === 1 ? '' : 's'} left`,
        bonuses: pl.falls === 0 && pl.hits >= 3 ? [{ label: 'Flawless', pts: 40 }] : pl.kos >= 3 ? [{ label: 'Hat-trick', pts: 30 }] : [],
      };
    });
    return { perfs };
  },
});

function strike(s: S, ctx: { ids: string[]; event(t: string, d?: unknown): void }, pl: P, now: number) {
  const kind = pl.atkKind;
  const hx = kind === 2 ? pl.x : pl.x + pl.face * (kind === 3 ? 44 : 36);
  const hy = kind === 2 ? pl.y - 40 : pl.y - 2;
  const reach = kind === 3 ? 42 : 36;
  let any = false;
  for (const id of ctx.ids) {
    const o = s.p[id];
    if (o === pl || o.out || o.deadUntil || now < o.invulnUntil) continue;
    if (Math.hypot(o.x - hx, o.y - hy) > reach + KC.HW) continue;
    const dmg = kind === 3 ? 15 : kind === 2 ? 9 : 7;
    o.pct = Math.min(999, o.pct + dmg);
    const kb = (kind === 3 ? 1.55 : 1) * (240 + o.pct * 7.2);
    let dx = kind === 2 ? pl.face * 0.15 : pl.face;
    let dy = kind === 2 ? -1 : -0.55;
    const m = Math.hypot(dx, dy);
    dx /= m;
    dy /= m;
    o.vx = dx * kb;
    o.vy = dy * kb;
    o.ground = false;
    o.stunUntil = now + 140 + kb * 0.35;
    o.lastHitBy = pl.id;
    pl.hits++;
    any = true;
    s.fx.push({ x: r1(o.x), y: r1(o.y), at: now, k: kind === 3 ? 'smash' : 'hit' });
    ctx.event('hit', { id: o.id, by: pl.id, pct: Math.round(o.pct), smash: kind === 3 ? 1 : 0 });
  }
  if (!any) ctx.event('swing', { id: pl.id });
}
