// Ricochet Tanks: little toy tanks in a walled arena. Shots bounce off walls twice, so bank them
// around corners... but careful, a bounced shot can hit you too. Shots that meet cancel out.
// Drop a mine to guard a corridor. Most kills wins; every hit respawns you after a moment.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, r1 } from '../../engine/arena';

export const RT = { W: 1000, H: 700, R: 22, BR: 6 } as const;
const DURATION = 80_000;
const SPEED = 190;
const SHOT_SPEED = 470;
const MAX_SHOTS = 3;
const SHOT_CD = 320;
const BOUNCES = 2;
const RESPAWN = 1800;
const INVULN = 1500;
const MINE_ARM = 900;
const MINE_LIFE = 9000;
const MINE_BLAST = 95;

export const BLOCKS: [number, number, number, number][] = [
  [455, 290, 90, 120],
  [190, 140, 160, 36],
  [650, 140, 160, 36],
  [190, 524, 160, 36],
  [650, 524, 160, 36],
  [110, 300, 36, 100],
  [854, 300, 36, 100],
  [300, 320, 36, 60],
  [664, 320, 36, 60],
];
const SPAWNS = [[60, 60], [940, 640], [940, 60], [60, 640], [500, 60], [500, 640], [60, 350], [940, 350]];

interface P { id: string; x: number; y: number; a: number; alive: boolean; respawnAt: number; invulnUntil: number; fireAt: number; kills: number; deaths: number; selfs: number; shots: number; minesSet: number }
interface Shot { id: number; owner: string; x: number; y: number; vx: number; vy: number; bounces: number; life: number }
interface Mine { id: number; owner: string; x: number; y: number; at: number; exploded: boolean }

interface S {
  t0: number;
  endsAt: number;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  shots: Shot[];
  mines: Mine[];
  seq: number;
  fx: { x: number; y: number; at: number; k: string }[];
}

function inBlock(x: number, y: number, pad: number) {
  for (const [bx, by, bw, bh] of BLOCKS) if (x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad) return [bx, by, bw, bh] as const;
  return null;
}

function pushOut(p: { x: number; y: number }, r: number) {
  for (const [bx, by, bw, bh] of BLOCKS) {
    const cx = Math.max(bx, Math.min(bx + bw, p.x));
    const cy = Math.max(by, Math.min(by + bh, p.y));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < r) {
      if (d < 0.001) {
        p.y = by - r;
        continue;
      }
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
    }
  }
  p.x = Math.max(r, Math.min(RT.W - r, p.x));
  p.y = Math.max(r, Math.min(RT.H - r, p.y));
}

/** true if a straight shot from a to b is not blocked by any block */
function clearLine(ax: number, ay: number, bx: number, by: number) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 14);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (inBlock(ax + (bx - ax) * t, ay + (by - ay) * t, 4)) return false;
  }
  return true;
}

function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const ricochetTanks = defineGame<S>({
  id: 'ricochet-tanks',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const p: Record<string, P> = {};
    ctx.ids.forEach((id, i) => {
      const [x, y] = SPAWNS[i % SPAWNS.length];
      p[id] = { id, x, y, a: Math.atan2(350 - y, 500 - x), alive: true, respawnAt: 0, invulnUntil: 0, fireAt: 0, kills: 0, deaths: 0, selfs: 0, shots: 0, minesSet: 0 };
    });
    return { t0: 0, endsAt: 0, p, inputs: {}, btn: new Buttons(), shots: [], mines: [], seq: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now();
    s.endsAt = s.t0 + ctx.ms(DURATION);
    for (const id of ctx.ids) s.p[id].invulnUntil = s.t0 + INVULN;
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const f = s.inputs[id];
      const fire = s.btn.pressed(id, f, 1);
      const mine = s.btn.pressed(id, f, 2);
      if (!pl.alive) {
        if (now >= pl.respawnAt) {
          // respawn at the spawn point farthest from everyone else
          let best = SPAWNS[0];
          let bd = -1;
          for (const sp of SPAWNS) {
            let md = Infinity;
            for (const o of ctx.ids) if (o !== id && s.p[o].alive) md = Math.min(md, Math.hypot(s.p[o].x - sp[0], s.p[o].y - sp[1]));
            if (md > bd) {
              bd = md;
              best = sp;
            }
          }
          pl.x = best[0];
          pl.y = best[1];
          pl.alive = true;
          pl.invulnUntil = now + INVULN;
        }
        continue;
      }
      const ix = f?.x ?? 0;
      const iy = f?.y ?? 0;
      const mag = Math.min(1, Math.hypot(ix, iy));
      if (mag > 0.15) {
        const target = Math.atan2(iy, ix);
        const d = angDiff(pl.a, target);
        pl.a += Math.sign(d) * Math.min(Math.abs(d), 7 * dt);
        // small stick = aim in place; push further to drive
        const sp = Math.max(0, (mag - 0.4) / 0.6) * SPEED * (Math.abs(d) > 1.2 ? 0.35 : 1);
        pl.x += Math.cos(pl.a) * sp * dt;
        pl.y += Math.sin(pl.a) * sp * dt;
      }
      pushOut(pl, RT.R);
      if (fire && now - pl.fireAt > SHOT_CD && s.shots.filter((x) => x.owner === id).length < MAX_SHOTS) {
        pl.fireAt = now;
        pl.shots++;
        const bx = pl.x + Math.cos(pl.a) * 30;
        const by = pl.y + Math.sin(pl.a) * 30;
        s.shots.push({ id: ++s.seq, owner: id, x: bx, y: by, vx: Math.cos(pl.a) * SHOT_SPEED, vy: Math.sin(pl.a) * SHOT_SPEED, bounces: inBlock(bx, by, RT.BR) ? BOUNCES : 0, life: 3.2 });
        ctx.event('shot', { id });
      }
      if (mine && !s.mines.some((m) => m.owner === id && !m.exploded)) {
        pl.minesSet++;
        s.mines.push({ id: ++s.seq, owner: id, x: r1(pl.x), y: r1(pl.y), at: now, exploded: false });
        ctx.event('mine', { id });
      }
    }
    // tanks bump each other
    const live = ctx.ids.filter((id) => s.p[id].alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = s.p[live[i]];
        const b = s.p[live[j]];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < RT.R * 2) {
          const o = (RT.R * 2 - d) / 2;
          a.x -= (dx / d) * o;
          a.y -= (dy / d) * o;
          b.x += (dx / d) * o;
          b.y += (dy / d) * o;
        }
      }
    }
    // shots
    for (const sh of s.shots) {
      const px = sh.x;
      const py = sh.y;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt;
      let bounced = false;
      if (sh.x < RT.BR || sh.x > RT.W - RT.BR) {
        sh.vx = -sh.vx;
        sh.x = Math.max(RT.BR, Math.min(RT.W - RT.BR, sh.x));
        bounced = true;
      }
      if (sh.y < RT.BR || sh.y > RT.H - RT.BR) {
        sh.vy = -sh.vy;
        sh.y = Math.max(RT.BR, Math.min(RT.H - RT.BR, sh.y));
        bounced = true;
      }
      const blk = inBlock(sh.x, sh.y, RT.BR);
      if (blk) {
        const [bx, by, bw, bh] = blk;
        const wasOutX = px <= bx - RT.BR || px >= bx + bw + RT.BR;
        if (wasOutX) sh.vx = -sh.vx;
        else sh.vy = -sh.vy;
        sh.x = px;
        sh.y = py;
        bounced = true;
      }
      if (bounced) {
        sh.bounces++;
        if (sh.bounces > BOUNCES) sh.life = -1;
        else ctx.event('bounce', {});
      }
    }
    // shots cancel each other
    for (let i = 0; i < s.shots.length; i++) {
      for (let j = i + 1; j < s.shots.length; j++) {
        const a = s.shots[i];
        const b = s.shots[j];
        if (a.life > 0 && b.life > 0 && Math.hypot(a.x - b.x, a.y - b.y) < RT.BR * 2 + 2) {
          a.life = -1;
          b.life = -1;
          s.fx.push({ x: r1(a.x), y: r1(a.y), at: now, k: 'c' });
        }
      }
    }
    for (const sh of s.shots) {
      if (sh.life <= 0) continue;
      for (const id of ctx.ids) {
        const pl = s.p[id];
        if (!pl.alive || now < pl.invulnUntil) continue;
        if (id === sh.owner && sh.bounces === 0) continue;
        if (Math.hypot(pl.x - sh.x, pl.y - sh.y) < RT.R + RT.BR) {
          sh.life = -1;
          destroy(s, ctx, id, sh.owner, now);
          break;
        }
      }
    }
    s.shots = s.shots.filter((x) => x.life > 0);
    // mines
    for (const m of s.mines) {
      if (m.exploded) continue;
      const armed = now - m.at > MINE_ARM;
      const trip = armed && ctx.ids.some((id) => id !== m.owner && s.p[id].alive && Math.hypot(s.p[id].x - m.x, s.p[id].y - m.y) < 55);
      const shotHit = s.shots.some((sh) => Math.hypot(sh.x - m.x, sh.y - m.y) < 16);
      if (trip || shotHit || now - m.at > MINE_LIFE) {
        m.exploded = true;
        s.fx.push({ x: m.x, y: m.y, at: now, k: 'm' });
        ctx.event('boom', {});
        for (const id of ctx.ids) {
          const pl = s.p[id];
          if (pl.alive && now >= pl.invulnUntil && Math.hypot(pl.x - m.x, pl.y - m.y) < MINE_BLAST) destroy(s, ctx, id, m.owner, now);
        }
        for (const sh of s.shots) if (Math.hypot(sh.x - m.x, sh.y - m.y) < MINE_BLAST) sh.life = -1;
      }
    }
    s.mines = s.mines.filter((m) => !m.exploded);
    s.shots = s.shots.filter((x) => x.life > 0);
    s.fx = s.fx.filter((f) => now - f.at < 600);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.x), y: r1(pl.y), a: Math.round(pl.a * 100) / 100, al: pl.alive ? 1 : 0, inv: now < pl.invulnUntil ? 1 : 0 };
      }),
      o: s.shots.map((sh) => ({ id: sh.id, x: r1(sh.x), y: r1(sh.y), b: sh.bounces })),
      mines: s.mines.map((m) => ({ id: m.id, x: m.x, y: m.y, ar: now - m.at > MINE_ARM ? 1 : 0, ow: m.owner })),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].kills - s.p[id].selfs])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    if (!me.alive) return null;
    const now = ctx.now();
    const skill = ctx.diff(0.35, 0.6, 0.88);
    // dodge incoming shots
    for (const sh of s.shots) {
      const dx = me.x - sh.x;
      const dy = me.y - sh.y;
      const d = Math.hypot(dx, dy);
      if (d > 160 || (sh.owner === pid && sh.bounces === 0)) continue;
      const toward = (dx * sh.vx + dy * sh.vy) / (d * SHOT_SPEED);
      if (toward > 0.85 && ctx.rng.next() < skill) {
        const px = -sh.vy / SHOT_SPEED;
        const py = sh.vx / SHOT_SPEED;
        const side = px * dx + py * dy > 0 ? 1 : -1;
        return { input: { x: px * side, y: py * side, b: 0 } };
      }
    }
    let target: P | null = null;
    let td = Infinity;
    for (const id of ctx.ids) {
      const o = s.p[id];
      if (id === pid || !o.alive) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < td) {
        td = d;
        target = o;
      }
    }
    if (!target) return { input: { x: 0, y: 0, b: 0 } };
    const tx = target.x;
    const ty = target.y;
    const want = Math.atan2(ty - me.y, tx - me.x);
    const los = clearLine(me.x, me.y, tx, ty);
    const diff = Math.abs(angDiff(me.a, want));
    if (los) {
      const fire = diff < 0.12 + (1 - skill) * 0.2 && now - me.fireAt > SHOT_CD && ctx.rng.next() < 0.5 + skill * 0.4;
      const drive = td > 320 ? 1 : 0.3;
      const mine = td < 120 && ctx.rng.next() < 0.1 ? 2 : 0;
      return { input: { x: Math.cos(want) * drive, y: Math.sin(want) * drive, b: (fire ? 1 : 0) | mine } };
    }
    // no line of sight: drive around, sliding along walls
    const wob = Math.sin(now / 700 + pid.length) * 0.9;
    const a = want + wob;
    return { input: { x: Math.cos(a), y: Math.sin(a), b: 0 } };
  },
  results(s, ctx) {
    const sc = (id: string) => s.p[id].kills * 2 - s.p[id].selfs - s.p[id].deaths * 0.5;
    const best = Math.max(1, ...ctx.ids.map((id) => s.p[id].kills));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const pl = s.p[id];
      perfs[id] = {
        score: Math.round(sc(id) * 10),
        perf: Math.max(0, Math.min(1, (pl.kills - pl.selfs) / best)),
        participated: ctx.acted(id),
        highlight: `${pl.kills} kill${pl.kills === 1 ? '' : 's'} · destroyed ${pl.deaths}×${pl.selfs ? ` · ${pl.selfs} own goal${pl.selfs === 1 ? '' : 's'} 🤦` : ''}`,
        bonuses: pl.kills >= 3 && pl.deaths === 0 ? [{ label: 'Untouchable', pts: 40 }] : [],
      };
    }
    return { perfs };
  },
});

function destroy(s: S, ctx: { event(t: string, d?: unknown): void }, id: string, by: string, now: number) {
  const pl = s.p[id];
  pl.alive = false;
  pl.deaths++;
  pl.respawnAt = now + RESPAWN;
  if (by === id) pl.selfs++;
  else s.p[by].kills++;
  s.fx.push({ x: r1(pl.x), y: r1(pl.y), at: now, k: 'x' });
  ctx.event('destroyed', { id, by });
}
