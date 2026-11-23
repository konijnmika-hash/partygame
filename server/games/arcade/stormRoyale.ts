// Storm Royale: a tiny top-down battle royale. Everyone parachutes in, loots chests for better
// blasters (grey -> green -> blue -> purple -> gold), builds quick walls for cover and fights
// while the storm circle shrinks. Last Bloop standing wins; eliminations score too.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dist, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const SR = { W: 1000, H: 700, R: 22 } as const;
const DURATION = 95_000;
const DROP_MS = 2500;
const BULLET_SPEED = 700;
/** damage and fire interval per rarity tier */
const TIERS = [
  { dmg: 4, cd: 450 },
  { dmg: 5, cd: 420 },
  { dmg: 6, cd: 390 },
  { dmg: 8, cd: 360 },
  { dmg: 10, cd: 330 },
];
const WALL_LEN = 84;
const WALL_HP = 30;
const WALL_CD = 1400;
const MAX_WALLS = 3;

interface P { b: Body; hp: number; sh: number; tier: number; aimX: number; aimY: number; fireAt: number; wallAt: number; alive: boolean; diedAt: number; elims: number; dmgDealt: number; place: number }
interface Bullet { id: number; owner: string; x: number; y: number; vx: number; vy: number; dmg: number; life: number; tier: number }
interface Wall { id: number; owner: string; x: number; y: number; a: number; hp: number }
interface Loot { id: number; x: number; y: number; kind: 'chest' | 'shield' | 'med' }
interface Storm { x: number; y: number; r: number }

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  bullets: Bullet[];
  walls: Wall[];
  loot: Loot[];
  seq: number;
  storm: Storm;
  from: Storm;
  to: Storm;
  phaseAt: number;
  phaseEnd: number;
  phase: number;
  alive: number;
  fx: { x: number; y: number; at: number; k: string }[];
  feed: { by: string; who: string; at: number }[];
}

const PHASES = [
  // [wait ms, shrink ms, radius]
  [9000, 9000, 330],
  [6000, 9000, 210],
  [5000, 9000, 120],
  [4000, 8000, 55],
  [3000, 8000, 0],
];

function segDist(px: number, py: number, w: Wall): { d: number; nx: number; ny: number } {
  const cx = Math.cos(w.a) * (WALL_LEN / 2);
  const cy = Math.sin(w.a) * (WALL_LEN / 2);
  const ax = w.x - cx, ay = w.y - cy, bx = w.x + cx, by = w.y + cy;
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  const qx = ax + vx * t, qy = ay + vy * t;
  const dx = px - qx, dy = py - qy;
  const d = Math.hypot(dx, dy) || 0.001;
  return { d, nx: dx / d, ny: dy / d };
}

function spawnLoot(s: S, ctx: { rng: { next(): number } }, kind: Loot['kind']) {
  const a = ctx.rng.next() * Math.PI * 2;
  const rr = Math.sqrt(ctx.rng.next()) * Math.max(60, s.to.r * 0.9);
  const x = Math.max(40, Math.min(SR.W - 40, s.to.x + Math.cos(a) * rr));
  const y = Math.max(40, Math.min(SR.H - 40, s.to.y + Math.sin(a) * rr));
  s.loot.push({ id: ++s.seq, x: Math.round(x), y: Math.round(y), kind });
}

export const stormRoyale = defineGame<S>({
  id: 'storm-royale',
  realtime: true,
  botDelay: [90, 160],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      p[id] = {
        b: makeBody(id, SR.W / 2 + Math.cos(a) * 380, SR.H / 2 + Math.sin(a) * 260, SR.R),
        hp: 100, sh: 50, tier: 0, aimX: -Math.cos(a), aimY: -Math.sin(a), fireAt: 0, wallAt: 0, alive: true, diedAt: 0, elims: 0, dmgDealt: 0, place: 0,
      };
    });
    const storm = { x: SR.W / 2, y: SR.H / 2, r: 640 };
    const s: S = {
      t0: 0, endsAt: 0, p, inputs: {}, btn: new Buttons(), bullets: [], walls: [], loot: [], seq: 0,
      storm: { ...storm }, from: { ...storm }, to: { ...storm }, phaseAt: 0, phaseEnd: 0, phase: -1, alive: n, fx: [], feed: [],
    };
    const chests = Math.max(3, Math.min(9, n + 2));
    for (let i = 0; i < chests; i++) spawnLoot(s, ctx, 'chest');
    for (let i = 0; i < 3; i++) spawnLoot(s, ctx, i % 2 ? 'med' : 'shield');
    return s;
  },
  start(s, ctx) {
    s.t0 = ctx.now();
    s.endsAt = s.t0 + ctx.ms(DURATION);
    s.phaseAt = s.t0;
    s.phaseEnd = s.t0;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt || s.alive <= 1) return ctx.end();
    // storm phases: wait, then shrink toward the next circle
    if (now >= s.phaseEnd) {
      s.phase++;
      const ph = PHASES[Math.min(s.phase, PHASES.length - 1)];
      s.from = { ...s.storm };
      const r = ph[2];
      const maxOff = Math.max(0, s.storm.r - r) * 0.6;
      const a = ctx.rng.next() * Math.PI * 2;
      const off = ctx.rng.next() * maxOff;
      const tx = Math.max(r * 0.3 + 60, Math.min(SR.W - r * 0.3 - 60, s.storm.x + Math.cos(a) * off));
      const ty = Math.max(r * 0.3 + 60, Math.min(SR.H - r * 0.3 - 60, s.storm.y + Math.sin(a) * off));
      s.to = { x: tx, y: ty, r };
      s.phaseAt = now + ctx.ms(ph[0]);
      s.phaseEnd = s.phaseAt + ctx.ms(ph[1]);
      if (s.phase > 0) {
        spawnLoot(s, ctx, 'chest');
        spawnLoot(s, ctx, ctx.rng.next() < 0.5 ? 'shield' : 'med');
      }
      ctx.event('storm', { phase: s.phase });
    }
    if (now >= s.phaseAt) {
      const k = Math.min(1, (now - s.phaseAt) / Math.max(1, s.phaseEnd - s.phaseAt));
      s.storm = { x: s.from.x + (s.to.x - s.from.x) * k, y: s.from.y + (s.to.y - s.from.y) * k, r: s.from.r + (s.to.r - s.from.r) * k };
    }
    const dropping = now - s.t0 < DROP_MS;
    const living = ctx.ids.filter((id) => s.p[id].alive);
    for (const id of living) {
      const pl = s.p[id];
      const f = s.inputs[id];
      steer(pl.b, f, dt, 1500, dropping ? 340 : 260, 4);
      if (f && Math.hypot(f.x, f.y) > 0.3) {
        const m = Math.hypot(f.x, f.y);
        pl.aimX = f.x / m;
        pl.aimY = f.y / m;
      }
      if (dropping) continue;
      // hold A to fire
      if (f && (f.b & 1) && now - pl.fireAt > TIERS[pl.tier].cd) {
        pl.fireAt = now;
        // light aim assist: snap to a rival who is roughly in front of you
        let bestA = 0.32;
        for (const o of living) {
          if (o === id) continue;
          const ob = s.p[o].b;
          const d = dist(pl.b, ob);
          if (d > 520) continue;
          const ang = Math.acos(Math.max(-1, Math.min(1, ((ob.x - pl.b.x) * pl.aimX + (ob.y - pl.b.y) * pl.aimY) / (d || 1))));
          if (ang < bestA) {
            bestA = ang;
            pl.aimX = (ob.x - pl.b.x) / d;
            pl.aimY = (ob.y - pl.b.y) / d;
          }
        }
        const spread = (ctx.rng.next() - 0.5) * 0.08;
        const ca = Math.cos(spread), sa = Math.sin(spread);
        const dx = pl.aimX * ca - pl.aimY * sa;
        const dy = pl.aimX * sa + pl.aimY * ca;
        s.bullets.push({ id: ++s.seq, owner: id, x: pl.b.x + dx * 30, y: pl.b.y + dy * 30, vx: dx * BULLET_SPEED, vy: dy * BULLET_SPEED, dmg: TIERS[pl.tier].dmg, life: 0.62, tier: pl.tier });
      }
      // B builds a wall in front of you
      if (f && s.btn.pressed(id, f, 2) && now - pl.wallAt > WALL_CD) {
        pl.wallAt = now;
        const mine = s.walls.filter((w) => w.owner === id);
        if (mine.length >= MAX_WALLS) s.walls = s.walls.filter((w) => w !== mine[0]);
        s.walls.push({ id: ++s.seq, owner: id, x: r1(pl.b.x + pl.aimX * 48), y: r1(pl.b.y + pl.aimY * 48), a: Math.atan2(pl.aimY, pl.aimX) + Math.PI / 2, hp: WALL_HP });
        ctx.event('build', { id });
      }
    }
    collide(living.map((id) => s.p[id].b), 0.6);
    for (const id of living) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      clampRect(pl.b, 0, 0, SR.W, SR.H, 0.3);
      for (const w of s.walls) {
        const sd = segDist(pl.b.x, pl.b.y, w);
        if (sd.d < SR.R + 7) {
          pl.b.x += sd.nx * (SR.R + 7 - sd.d);
          pl.b.y += sd.ny * (SR.R + 7 - sd.d);
        }
      }
      // loot
      for (const l of s.loot) {
        if (l.id < 0 || dist(pl.b, l) > SR.R + 22) continue;
        if (l.kind === 'chest') {
          if (pl.tier >= TIERS.length - 1) continue;
          pl.tier = Math.min(TIERS.length - 1, pl.tier + 1 + (ctx.rng.next() < 0.12 ? 1 : 0));
        } else if (l.kind === 'shield') {
          if (pl.sh >= 50) continue;
          pl.sh = Math.min(50, pl.sh + 25);
        } else {
          if (pl.hp >= 100) continue;
          pl.hp = Math.min(100, pl.hp + 30);
        }
        ctx.event('loot', { id, kind: l.kind, tier: pl.tier });
        l.id = -1;
      }
      // storm damage
      if (!dropping && dist(pl.b, s.storm) > s.storm.r) hurt(s, ctx, id, null, (4 + s.phase * 2) * dt, now);
    }
    s.loot = s.loot.filter((l) => l.id > 0);
    // bullets
    for (const bl of s.bullets) {
      bl.x += bl.vx * dt;
      bl.y += bl.vy * dt;
      bl.life -= dt;
      for (const w of s.walls) {
        if (w.hp > 0 && segDist(bl.x, bl.y, w).d < 9) {
          w.hp -= bl.dmg;
          bl.life = -1;
          s.fx.push({ x: r1(bl.x), y: r1(bl.y), at: now, k: 'w' });
          break;
        }
      }
      if (bl.life < 0) continue;
      for (const id of ctx.ids) {
        const pl = s.p[id];
        if (!pl.alive || id === bl.owner) continue;
        if (dist(pl.b, bl) < SR.R + 5) {
          bl.life = -1;
          s.fx.push({ x: r1(bl.x), y: r1(bl.y), at: now, k: 'h' });
          pl.b.vx += bl.vx * 0.12;
          pl.b.vy += bl.vy * 0.12;
          hurt(s, ctx, id, bl.owner, bl.dmg, now);
          break;
        }
      }
    }
    s.walls = s.walls.filter((w) => w.hp > 0);
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < SR.W + 20 && b.y > -20 && b.y < SR.H + 20);
    s.fx = s.fx.filter((f) => now - f.at < 400);
    s.feed = s.feed.filter((f) => now - f.at < 4000);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      dropUntil: s.t0 + DROP_MS,
      storm: { x: r1(s.storm.x), y: r1(s.storm.y), r: r1(s.storm.r) },
      next: { x: r1(s.to.x), y: r1(s.to.y), r: r1(s.to.r) },
      shrinkAt: s.phaseAt,
      alive: s.alive,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), hp: Math.ceil(pl.hp), sh: Math.ceil(pl.sh), t: pl.tier, al: pl.alive ? 1 : 0, ax: Math.round(pl.aimX * 100) / 100, ay: Math.round(pl.aimY * 100) / 100, wr: Math.max(0, pl.wallAt + WALL_CD - now) };
      }),
      o: s.bullets.map((b) => ({ id: b.id, x: r1(b.x), y: r1(b.y), t: b.tier })),
      walls: s.walls.map((w) => ({ id: w.id, x: w.x, y: w.y, a: Math.round(w.a * 100) / 100, hp: w.hp })),
      loot: s.loot.map((l) => ({ id: l.id, x: l.x, y: l.y, k: l.kind })),
      fx: s.fx,
      feed: s.feed,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].elims])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    if (!me.alive) return null;
    const now = ctx.now();
    const skill = ctx.diff(0.4, 0.65, 0.9);
    // get back into the circle first
    const outside = dist(me.b, s.storm) > s.storm.r - 40;
    const nextOutside = now > s.phaseAt - 3000 && dist(me.b, s.to) > s.to.r - 30;
    if (outside || nextOutside) return { input: seek(me.b, outside ? s.storm : s.to, 0.2) };
    let target: P | null = null;
    let td = Infinity;
    for (const id of ctx.ids) {
      if (id === pid || !s.p[id].alive) continue;
      const d = dist(me.b, s.p[id].b);
      if (d < td) {
        td = d;
        target = s.p[id];
      }
    }
    let chest: Loot | null = null;
    let cd = Infinity;
    for (const l of s.loot) {
      if (l.kind !== 'chest' && !(l.kind === 'shield' && me.sh < 25) && !(l.kind === 'med' && me.hp < 60)) continue;
      if (l.kind === 'chest' && me.tier >= TIERS.length - 1) continue;
      const d = dist(me.b, l);
      if (d < cd) {
        cd = d;
        chest = l;
      }
    }
    if (chest && (me.tier < 2 || cd < 160) && (!target || td > (now - s.t0 < 15000 ? 140 : 260) || cd < 90)) return { input: seek(me.b, chest, 0.2) };
    if (!target) return { input: seek(me.b, s.storm, 0.4) };
    // early on, bots roam and loot instead of rushing the nearest rival
    if (now - s.t0 < ctx.diff(26000, 20000, 14000) && td > 170) {
      const a = (now / 3000 + pid.length * 1.7) % (Math.PI * 2);
      const roam = { x: s.storm.x + Math.cos(a) * Math.min(260, s.storm.r * 0.6), y: s.storm.y + Math.sin(a) * Math.min(200, s.storm.r * 0.5) };
      return { input: seek(me.b, chest ?? roam, 0.3) };
    }
    const lead = (td / BULLET_SPEED) * skill;
    const aim = { x: target.b.x + target.b.vx * lead, y: target.b.y + target.b.vy * lead };
    const inp = seek(me.b, aim, (1 - skill) * 0.5);
    if (td < 340 && ctx.rng.next() < 0.25 + skill * 0.45) inp.b = 1;
    if (td < 200) {
      // close enough: mostly stand and shoot (a tiny push keeps the aim on target)
      inp.x *= 0.33;
      inp.y *= 0.33;
    }
    if (me.hp + me.sh < 50 && td < 320 && now - me.wallAt > WALL_CD && ctx.rng.next() < 0.15 * skill) inp.b |= 2;
    return { input: inp };
  },
  results(s, ctx) {
    const n = ctx.ids.length;
    // living players share first place, ranked by remaining health
    const living = ctx.ids.filter((id) => s.p[id].alive).sort((a, b) => s.p[b].hp + s.p[b].sh - (s.p[a].hp + s.p[a].sh));
    living.forEach((id, i) => (s.p[id].place = 1 + i));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const place = pl.place || n;
      const won = place === 1;
      perfs[id] = {
        score: (n - place) * 100 + pl.elims * 60 + Math.round(pl.dmgDealt / 10),
        perf: Math.min(1, (n - place) / Math.max(1, n - 1) * 0.7 + Math.min(1, pl.elims / 3) * 0.3),
        participated: ctx.acted(id),
        highlight: `${won ? '🏆 Victory Royale! · ' : `#${place} · `}${pl.elims} elimination${pl.elims === 1 ? '' : 's'} · ${Math.round(pl.dmgDealt)} damage`,
        bonuses: won ? [{ label: 'Last one standing', pts: 50 }] : pl.elims >= 3 ? [{ label: 'Elimination spree', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});

function hurt(s: S, ctx: { event(t: string, d?: unknown): void; ids: string[] }, id: string, by: string | null, dmg: number, now: number) {
  const pl = s.p[id];
  if (!pl.alive) return;
  if (by) s.p[by].dmgDealt += dmg;
  const toShield = Math.min(pl.sh, dmg);
  pl.sh -= toShield;
  pl.hp -= dmg - toShield;
  if (pl.hp > 0) return;
  pl.hp = 0;
  pl.alive = false;
  pl.diedAt = now;
  pl.place = s.alive;
  s.alive--;
  if (by) s.p[by].elims++;
  s.feed.push({ by: by ?? '', who: id, at: now });
  // drop a chest where you fell
  if (pl.tier > 0) s.loot.push({ id: ++s.seq, x: Math.round(pl.b.x), y: Math.round(pl.b.y), kind: 'chest' });
  ctx.event('elim', { id, by });
}
