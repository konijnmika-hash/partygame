// Dot Muncher: everyone munches dots in the same maze while ghosts roam the corridors. Grab a
// power pellet and the ghosts turn blue: now YOU can eat them... and the other players too!
// Dots come back in a fresh wave once the maze is cleared. Most points wins.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { r1 } from '../../engine/arena';

export const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.##-##.#.##.#',
  '#....#.#HHH#.#....#',
  '.....#.#HHH#.#.....',
  '#.##.#.#####.#.##.#',
  '#.................#',
  '#.##.###.#.###.##.#',
  '#o..#....#....#..o#',
  '#.#...#.....#...#.#',
  '###################',
];
export const DM = { COLS: 19, ROWS: 13, CELL: 50 } as const;
const DURATION = 80_000;
const POWER_MS = 6500;
const DIRS: Record<number, [number, number]> = { 0: [0, 0], 1: [1, 0], 2: [-1, 0], 3: [0, 1], 4: [0, -1] };
const OPP: Record<number, number> = { 0: 0, 1: 2, 2: 1, 3: 4, 4: 3 };
const SPAWNS = [[1, 1], [17, 11], [17, 1], [1, 11], [9, 3], [9, 8], [5, 8], [13, 8]];

interface Mover { x: number; y: number; dir: number; want: number }
interface P extends Mover { id: string; sx: number; sy: number; pts: number; dots: number; ghosts: number; players: number; deaths: number; powerUntil: number; invulnUntil: number }
interface Ghost extends Mover { id: number; homeUntil: number; target: string | null }

interface S {
  t0: number;
  endsAt: number;
  dots: Set<number>;
  pellets: Set<number>;
  wave: number;
  p: Record<string, P>;
  ghosts: Ghost[];
  fx: { x: number; y: number; at: number; k: string }[];
}

const idx = (c: number, r: number) => r * DM.COLS + c;
const cen = (c: number) => c * DM.CELL + DM.CELL / 2;
const cellOf = (v: number) => Math.floor(v / DM.CELL);

function tile(c: number, r: number): string {
  if (r < 0 || r >= DM.ROWS) return '#';
  const cc = ((c % DM.COLS) + DM.COLS) % DM.COLS;
  return MAZE[r][cc];
}

function open(c: number, r: number, ghost: boolean): boolean {
  const t = tile(c, r);
  if (t === '#') return false;
  if (t === 'H' || t === '-') return ghost;
  return true;
}

function fillDots(s: S) {
  for (let r = 0; r < DM.ROWS; r++) {
    for (let c = 0; c < DM.COLS; c++) {
      if (MAZE[r][c] === '.') s.dots.add(idx(c, r));
      if (MAZE[r][c] === 'o') s.pellets.add(idx(c, r));
    }
  }
}

/** Advance a grid mover; turns happen exactly on cell centres. */
function step(m: Mover, dist: number, ghost: boolean, choose?: (c: number, r: number) => number) {
  let left = dist;
  for (let guard = 0; left > 1e-6 && guard < 8; guard++) {
    const c = cellOf(m.x);
    const r = cellOf(m.y);
    const cx = cen(c);
    const cy = cen(r);
    // turning around is always allowed for players
    if (!choose && m.want && m.dir && m.want === OPP[m.dir]) m.dir = m.want;
    const [dx, dy] = DIRS[m.dir];
    const toC = m.dir ? (dx ? (cx - m.x) * dx : (cy - m.y) * dy) : 0;
    if (toC < -1e-6) {
      // past this centre, heading into the next (already checked) cell
      const toNext = DM.CELL + toC;
      const mv = Math.min(left, toNext);
      m.x += dx * mv;
      m.y += dy * mv;
      left -= mv;
      wrap(m);
      if (mv < toNext) return;
      m.x = cen(cellOf(m.x));
      m.y = cen(cellOf(m.y));
      continue;
    }
    if (toC > 1e-6) {
      if (left < toC) {
        m.x += dx * left;
        m.y += dy * left;
        return;
      }
      left -= toC;
    }
    m.x = cx;
    m.y = cy;
    // at a centre: pick the next direction
    if (choose) m.dir = choose(c, r);
    else if (m.want && open(c + DIRS[m.want][0], r + DIRS[m.want][1], ghost)) m.dir = m.want;
    const [ndx, ndy] = DIRS[m.dir];
    if (!m.dir || !open(c + ndx, r + ndy, ghost)) {
      m.dir = 0;
      return;
    }
    const mv = Math.min(left, DM.CELL);
    m.x += ndx * mv;
    m.y += ndy * mv;
    left -= mv;
    wrap(m);
    if (mv === DM.CELL) {
      m.x = cen(cellOf(m.x));
      m.y = cen(cellOf(m.y));
    }
  }
}

function wrap(m: Mover) {
  const W = DM.COLS * DM.CELL;
  if (m.x < 0) m.x += W;
  if (m.x >= W) m.x -= W;
}

function near(a: Mover, b: Mover, d = 30) {
  const W = DM.COLS * DM.CELL;
  let dx = Math.abs(a.x - b.x);
  dx = Math.min(dx, W - dx);
  return dx < d && Math.abs(a.y - b.y) < d;
}

export const dotMuncher = defineGame<S>({
  id: 'dot-muncher',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const p: Record<string, P> = {};
    ctx.ids.forEach((id, i) => {
      const [c, r] = SPAWNS[i % SPAWNS.length];
      p[id] = { id, x: cen(c), y: cen(r), dir: 0, want: 0, sx: c, sy: r, pts: 0, dots: 0, ghosts: 0, players: 0, deaths: 0, powerUntil: 0, invulnUntil: 0 };
    });
    const nG = ctx.ids.length > 4 ? 4 : 3;
    const ghosts: Ghost[] = [];
    for (let i = 0; i < nG; i++) ghosts.push({ id: i + 1, x: cen(8 + (i % 3)), y: cen(5 + (i > 2 ? 1 : 0)), dir: 0, want: 0, homeUntil: 0, target: null });
    const s: S = { t0: 0, endsAt: 0, dots: new Set(), pellets: new Set(), wave: 1, p, ghosts, fx: [] };
    fillDots(s);
    for (const pl of Object.values(p)) s.dots.delete(idx(pl.sx, pl.sy));
    return s;
  },
  start(s, ctx) {
    s.t0 = ctx.now();
    s.endsAt = s.t0 + ctx.ms(DURATION);
    s.ghosts.forEach((g, i) => (g.homeUntil = s.t0 + 1500 + i * 2200));
  },
  input(s, _ctx, pid, f) {
    const pl = s.p[pid];
    if (Math.abs(f.x) > 0.4 || Math.abs(f.y) > 0.4) pl.want = Math.abs(f.x) > Math.abs(f.y) ? (f.x > 0 ? 1 : 2) : f.y > 0 ? 3 : 4;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    const anyPower = ctx.ids.some((id) => s.p[id].powerUntil > now);
    for (const id of ctx.ids) {
      const pl = s.p[id];
      step(pl, (pl.powerUntil > now ? 245 : 225) * dt, false);
      const i = idx(cellOf(pl.x), cellOf(pl.y));
      if (s.dots.delete(i)) {
        pl.pts += 10;
        pl.dots++;
      }
      if (s.pellets.delete(i)) {
        pl.pts += 25;
        pl.powerUntil = now + POWER_MS;
        ctx.event('power', { id });
      }
    }
    if (s.dots.size === 0) {
      s.wave++;
      fillDots(s);
      ctx.event('wave', { n: s.wave });
    }
    const gSpeed = ctx.diff(150, 175, 200) + (s.wave - 1) * 10;
    for (const g of s.ghosts) {
      if (now < g.homeUntil) continue;
      const frightened = anyPower;
      // retarget now and then
      const targets = ctx.ids.filter((id) => now > s.p[id].invulnUntil);
      if (!g.target || ctx.rng.next() < 0.01 || !targets.includes(g.target)) {
        let best: string | null = null;
        let bd = Infinity;
        for (const id of targets) {
          const d = Math.abs(s.p[id].x - g.x) + Math.abs(s.p[id].y - g.y) + ctx.rng.next() * 200;
          if (d < bd) {
            bd = d;
            best = id;
          }
        }
        g.target = best;
      }
      const tgt = g.target ? s.p[g.target] : null;
      step(g, (frightened ? 105 : gSpeed) * dt, true, (c, r) => {
        const opts = [1, 2, 3, 4].filter((d) => d !== OPP[g.dir] && open(c + DIRS[d][0], r + DIRS[d][1], true));
        // leave the house through the door
        if (tile(c, r) === 'H' || tile(c, r) === '-') {
          if (open(c, r - 1, true) && (tile(c, r - 1) === '-' || c === 9)) return 4;
          return c < 9 ? 1 : c > 9 ? 2 : 4;
        }
        const choices = opts.filter((d) => tile(c + DIRS[d][0], r + DIRS[d][1]) !== '-' && tile(c + DIRS[d][0], r + DIRS[d][1]) !== 'H');
        const list = choices.length ? choices : opts.length ? opts : [OPP[g.dir] || 1];
        if (!tgt || ctx.rng.next() < 0.18) return ctx.rng.pick(list);
        let bestD = list[0];
        let bestV = frightened ? -Infinity : Infinity;
        for (const d of list) {
          const nx = cen(c + DIRS[d][0]);
          const ny = cen(r + DIRS[d][1]);
          const v = Math.hypot(nx - tgt.x, ny - tgt.y);
          if (frightened ? v > bestV : v < bestV) {
            bestV = v;
            bestD = d;
          }
        }
        return bestD;
      });
    }
    // contacts: ghosts
    for (const g of s.ghosts) {
      if (now < g.homeUntil) continue;
      for (const id of ctx.ids) {
        const pl = s.p[id];
        if (!near(pl, g)) continue;
        if (anyPower) {
          if (pl.powerUntil > now) {
            pl.pts += 60;
            pl.ghosts++;
            s.fx.push({ x: r1(g.x), y: r1(g.y), at: now, k: '+60' });
            g.x = cen(9);
            g.y = cen(5);
            g.dir = 0;
            g.homeUntil = now + 3000;
            ctx.event('eatGhost', { id });
            break;
          }
        } else if (now > pl.invulnUntil) {
          caught(s, ctx, pl, now, null);
        }
      }
    }
    // contacts: powered players eat the others
    for (const a of ctx.ids) {
      const A = s.p[a];
      if (A.powerUntil <= now) continue;
      for (const b of ctx.ids) {
        const B = s.p[b];
        if (a === b || B.powerUntil > now || now < B.invulnUntil || !near(A, B, 34)) continue;
        A.pts += 80;
        A.players++;
        s.fx.push({ x: r1(B.x), y: r1(B.y), at: now, k: '+80' });
        caught(s, ctx, B, now, a);
      }
    }
    s.fx = s.fx.filter((f) => now - f.at < 800);
  },
  pub(s, ctx) {
    const now = ctx.now();
    const anyPower = ctx.ids.some((id) => s.p[id].powerUntil > now);
    return {
      endsAt: s.endsAt,
      wave: s.wave,
      dots: [...s.dots],
      pel: [...s.pellets],
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.x), y: r1(pl.y), d: pl.dir, pw: pl.powerUntil > now ? Math.ceil((pl.powerUntil - now) / 1000) : 0, inv: now < pl.invulnUntil ? 1 : 0 };
      }),
      o: s.ghosts.map((g) => ({ id: g.id, x: r1(g.x), y: r1(g.y), fr: anyPower ? 1 : 0, h: now < g.homeUntil ? 1 : 0 })),
      fx: s.fx,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].pts])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    const skill = ctx.diff(0.4, 0.65, 0.9);
    const anyPower = ctx.ids.some((id) => s.p[id].powerUntil > now);
    const powered = me.powerUntil > now;
    const mc = cellOf(me.x);
    const mr = cellOf(me.y);
    const threats: { c: number; r: number }[] = [];
    if (!anyPower) for (const g of s.ghosts) if (now >= g.homeUntil) threats.push({ c: cellOf(g.x), r: cellOf(g.y) });
    if (!powered) for (const id of ctx.ids) if (id !== pid && s.p[id].powerUntil > now) threats.push({ c: cellOf(s.p[id].x), r: cellOf(s.p[id].y) });
    const danger = new Set<number>();
    const reach = Math.round(1 + skill * 2);
    for (const t of threats) {
      for (let dc = -reach; dc <= reach; dc++) for (let dr = -reach; dr <= reach; dr++) if (Math.abs(dc) + Math.abs(dr) <= reach) danger.add(idx(t.c + dc, t.r + dr));
    }
    const prey = new Set<number>();
    if (powered) {
      for (const g of s.ghosts) if (now >= g.homeUntil) prey.add(idx(cellOf(g.x), cellOf(g.y)));
      for (const id of ctx.ids) if (id !== pid && s.p[id].powerUntil <= now && now > s.p[id].invulnUntil) prey.add(idx(cellOf(s.p[id].x), cellOf(s.p[id].y)));
    }
    const start = idx(mc, mr);
    const prev = new Map<number, number>([[start, -1]]);
    const firstDir = new Map<number, number>([[start, 0]]);
    const q = [start];
    let goalDir = 0;
    while (q.length) {
      const cur = q.shift()!;
      const c = cur % DM.COLS;
      const r = Math.floor(cur / DM.COLS);
      if (cur !== start && (prey.size ? prey.has(cur) : s.dots.has(cur) || s.pellets.has(cur))) {
        goalDir = firstDir.get(cur)!;
        break;
      }
      for (const d of [1, 2, 3, 4]) {
        let nc = c + DIRS[d][0];
        const nr = r + DIRS[d][1];
        if (!open(nc, nr, false)) continue;
        nc = ((nc % DM.COLS) + DM.COLS) % DM.COLS;
        const ni = idx(nc, nr);
        if (prev.has(ni) || (danger.has(ni) && ni !== start)) continue;
        prev.set(ni, cur);
        firstDir.set(ni, cur === start ? d : firstDir.get(cur)!);
        q.push(ni);
      }
    }
    if (!goalDir) {
      // boxed in: run from the closest threat
      const opts = [1, 2, 3, 4].filter((d) => open(mc + DIRS[d][0], mr + DIRS[d][1], false));
      goalDir = opts.length ? ctx.rng.pick(opts) : 0;
    }
    if (ctx.rng.next() > 0.6 + skill * 0.4) return null;
    const [dx, dy] = DIRS[goalDir];
    return { input: { x: dx, y: dy, b: 0 } };
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
        highlight: `${pl.pts} pts · ${pl.dots} dots · ${pl.ghosts} ghost${pl.ghosts === 1 ? '' : 's'} · ${pl.players} Bloop${pl.players === 1 ? '' : 's'} munched`,
        bonuses: pl.ghosts >= 3 ? [{ label: 'Ghostbuster', pts: 30 }] : pl.deaths === 0 && pl.dots >= 30 ? [{ label: 'Untouched', pts: 20 }] : [],
      };
    }
    return { perfs };
  },
});

function caught(s: S, ctx: { event(t: string, d?: unknown): void }, pl: P, now: number, by: string | null) {
  pl.deaths++;
  pl.pts = Math.max(0, pl.pts - 50);
  s.fx.push({ x: r1(pl.x), y: r1(pl.y), at: now, k: '-50' });
  pl.x = cen(pl.sx);
  pl.y = cen(pl.sy);
  pl.dir = 0;
  pl.want = 0;
  pl.powerUntil = 0;
  pl.invulnUntil = now + 2500;
  ctx.event('caught', { id: pl.id, by });
}
