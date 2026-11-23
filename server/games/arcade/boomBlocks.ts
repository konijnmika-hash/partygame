// Boom Blocks: a grid maze full of crates. Drop bombs that blast in a cross, break crates for
// power-ups (more bombs, bigger blasts, faster shoes) and catch rivals in the flames. Bombs set
// each other off. Three hearts each; last Bloop standing wins.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, r1 } from '../../engine/arena';

export const BB = { COLS: 15, ROWS: 11, CELL: 60, R: 22 } as const;
const DURATION = 110_000;
const FUSE = 2300;
const FLAME_MS = 550;
const INVULN = 2200;
const HEARTS = 3;

type Item = 'bomb' | 'fire' | 'speed';
interface P { id: string; x: number; y: number; lives: number; bombs: number; range: number; speed: number; invulnUntil: number; out: boolean; outAt: number; kos: number; crates: number; items: number }
interface Bomb { id: number; c: number; r: number; owner: string; at: number; range: number; pass: Set<string> }
interface Flame { c: number; r: number; until: number; owner: string }

interface S {
  t0: number;
  endsAt: number;
  grid: number[]; // 0 empty, 1 wall, 2 crate
  items: Map<number, Item>;
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  bombs: Bomb[];
  flames: Flame[];
  seq: number;
  botJ: Record<string, boolean>;
  dirty: boolean;
}

const SPAWNS = [[1, 1], [13, 9], [13, 1], [1, 9], [7, 1], [7, 9], [1, 5], [13, 5]];
const idx = (c: number, r: number) => r * BB.COLS + c;
const center = (c: number) => c * BB.CELL + BB.CELL / 2;
const cellOf = (v: number) => Math.floor(v / BB.CELL);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function solid(s: S, c: number, r: number, pid?: string): boolean {
  if (c < 0 || r < 0 || c >= BB.COLS || r >= BB.ROWS) return true;
  if (s.grid[idx(c, r)] !== 0) return true;
  const b = s.bombs.find((b) => b.c === c && b.r === r);
  return !!b && !(pid && b.pass.has(pid));
}

/** Cells a bomb at c,r with this range would hit (stops at walls, includes the first crate). */
function blastCells(s: S, c: number, r: number, range: number): [number, number][] {
  const out: [number, number][] = [[c, r]];
  for (const [dx, dy] of DIRS) {
    for (let k = 1; k <= range; k++) {
      const cc = c + dx * k;
      const rr = r + dy * k;
      if (cc < 0 || rr < 0 || cc >= BB.COLS || rr >= BB.ROWS) break;
      const g = s.grid[idx(cc, rr)];
      if (g === 1) break;
      out.push([cc, rr]);
      if (g === 2) break;
    }
  }
  return out;
}

function move(s: S, pl: P, ix: number, iy: number, dist: number) {
  let axis: 'x' | 'y' | null = null;
  let d = 0;
  if (Math.abs(ix) >= Math.abs(iy) && Math.abs(ix) > 0.3) {
    axis = 'x';
    d = Math.sign(ix);
  } else if (Math.abs(iy) > 0.3) {
    axis = 'y';
    d = Math.sign(iy);
  }
  if (!axis) return;
  const along = axis === 'x' ? 'x' : 'y';
  const perp = axis === 'x' ? 'y' : 'x';
  // snap the perpendicular axis to the lane centre (corner assist)
  const lane = Math.round((pl[perp] - BB.CELL / 2) / BB.CELL);
  const off = pl[perp] - center(lane);
  const fix = Math.min(Math.abs(off), dist);
  pl[perp] -= Math.sign(off) * fix;
  if (Math.abs(off) - fix > 20) return;
  const cur = cellOf(pl[along]);
  const next = pl[along] + d * dist;
  const lead = cellOf(next + d * BB.R);
  const lc = axis === 'x' ? lead : lane;
  const lr = axis === 'x' ? lane : lead;
  if (lead !== cur && solid(s, lc, lr, pl.id)) {
    pl[along] = d > 0 ? Math.min(next, (cur + 1) * BB.CELL - BB.R - 0.01) : Math.max(next, cur * BB.CELL + BB.R + 0.01);
  } else pl[along] = next;
}

export const boomBlocks = defineGame<S>({
  id: 'boom-blocks',
  realtime: true,
  botDelay: [70, 120],
  setup(ctx) {
    const grid: number[] = [];
    const n = ctx.ids.length;
    const spawns = SPAWNS.slice(0, Math.max(2, n));
    const clear = new Set<number>();
    for (const [c, r] of spawns) {
      clear.add(idx(c, r));
      for (const [dx, dy] of DIRS) clear.add(idx(c + dx, r + dy));
    }
    const density = ctx.diff(0.55, 0.65, 0.72);
    for (let r = 0; r < BB.ROWS; r++) {
      for (let c = 0; c < BB.COLS; c++) {
        const edge = r === 0 || c === 0 || r === BB.ROWS - 1 || c === BB.COLS - 1;
        const pillar = c % 2 === 0 && r % 2 === 0;
        if (edge || pillar) grid.push(1);
        else if (!clear.has(idx(c, r)) && ctx.rng.next() < density) grid.push(2);
        else grid.push(0);
      }
    }
    const items = new Map<number, Item>();
    grid.forEach((g, i) => {
      if (g === 2 && ctx.rng.next() < 0.36) items.set(i, ctx.rng.pick(['bomb', 'fire', 'fire', 'speed'] as Item[]));
    });
    const p: Record<string, P> = {};
    ctx.ids.forEach((id, i) => {
      const [c, r] = SPAWNS[i % SPAWNS.length];
      p[id] = { id, x: center(c), y: center(r), lives: HEARTS, bombs: 1, range: 2, speed: 190, invulnUntil: 0, out: false, outAt: 0, kos: 0, crates: 0, items: 0 };
    });
    return { t0: 0, endsAt: 0, grid, items, p, inputs: {}, btn: new Buttons(), bombs: [], flames: [], seq: 0, botJ: {}, dirty: true };
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
    const living = ctx.ids.filter((id) => !s.p[id].out);
    if (now >= s.endsAt || (ctx.ids.length > 1 && living.length <= 1)) return ctx.end();
    for (const id of living) {
      const pl = s.p[id];
      const f = s.inputs[id];
      const drop = s.btn.pressed(id, f, 1) || s.btn.pressed(id, f, 2);
      move(s, pl, f?.x ?? 0, f?.y ?? 0, pl.speed * dt);
      const c = cellOf(pl.x);
      const r = cellOf(pl.y);
      if (drop) {
        const mine = s.bombs.filter((b) => b.owner === id).length;
        if (mine < pl.bombs && !s.bombs.some((b) => b.c === c && b.r === r)) {
          const pass = new Set<string>();
          for (const o of living) if (Math.abs(s.p[o].x - center(c)) < BB.CELL / 2 + BB.R && Math.abs(s.p[o].y - center(r)) < BB.CELL / 2 + BB.R) pass.add(o);
          s.bombs.push({ id: ++s.seq, c, r, owner: id, at: now + FUSE, range: pl.range, pass });
          ctx.event('drop', { id });
        }
      }
      const it = s.items.get(idx(c, r));
      if (it && s.grid[idx(c, r)] === 0) {
        s.items.delete(idx(c, r));
        pl.items++;
        if (it === 'bomb') pl.bombs = Math.min(6, pl.bombs + 1);
        if (it === 'fire') pl.range = Math.min(7, pl.range + 1);
        if (it === 'speed') pl.speed = Math.min(320, pl.speed + 30);
        ctx.event('item', { id, it });
      }
    }
    // players leave the bomb they're standing on -> it becomes solid for them
    for (const b of s.bombs) {
      for (const id of [...b.pass]) {
        const pl = s.p[id];
        if (pl.out || Math.abs(pl.x - center(b.c)) >= BB.CELL / 2 + BB.R - 2 || Math.abs(pl.y - center(b.r)) >= BB.CELL / 2 + BB.R - 2) b.pass.delete(id);
      }
    }
    // explosions (with chain reactions)
    let boomed = true;
    while (boomed) {
      boomed = false;
      for (const b of s.bombs) {
        if (now < b.at) continue;
        boomed = true;
        s.bombs = s.bombs.filter((x) => x !== b);
        for (const [c, r] of blastCells(s, b.c, b.r, b.range)) {
          const i = idx(c, r);
          if (s.grid[i] === 2) {
            s.grid[i] = 0;
            s.p[b.owner].crates++;
          }
          s.flames.push({ c, r, until: now + FLAME_MS, owner: b.owner });
          const other = s.bombs.find((x) => x.c === c && x.r === r);
          if (other) other.at = Math.min(other.at, now);
        }
        ctx.event('boom', { c: b.c, r: b.r });
        break;
      }
    }
    s.flames = s.flames.filter((f) => now < f.until);
    for (const id of living) {
      const pl = s.p[id];
      if (now < pl.invulnUntil) continue;
      const c = cellOf(pl.x);
      const r = cellOf(pl.y);
      const fl = s.flames.find((f) => f.c === c && f.r === r);
      if (!fl) continue;
      pl.lives--;
      pl.invulnUntil = now + INVULN;
      if (fl.owner !== id) s.p[fl.owner].kos++;
      ctx.event('hurt', { id, by: fl.owner, left: pl.lives });
      if (pl.lives <= 0) {
        pl.out = true;
        pl.outAt = now;
      }
    }
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      endsAt: s.endsAt,
      g: s.grid.join(''),
      it: [...s.items].filter(([i]) => s.grid[i] === 0).map(([i, k]) => [i, k[0]]),
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.x), y: r1(pl.y), l: pl.lives, o: pl.out ? 1 : 0, inv: now < pl.invulnUntil ? 1 : 0, b: pl.bombs, rg: pl.range };
      }),
      bombs: s.bombs.map((b) => ({ id: b.id, c: b.c, r: b.r, t: Math.max(0, b.at - now) })),
      fl: s.flames.map((f) => [f.c, f.r]),
      scores: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].kos])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    if (me.out) return null;
    const skill = ctx.diff(0.45, 0.7, 0.92);
    const lastJ = s.botJ[pid];
    s.botJ[pid] = false;
    const mc = cellOf(me.x);
    const mr = cellOf(me.y);
    // danger map from bombs and live flames
    const danger = new Set<number>();
    for (const b of s.bombs) for (const [c, r] of blastCells(s, b.c, b.r, b.range)) danger.add(idx(c, r));
    for (const f of s.flames) danger.add(idx(f.c, f.r));
    const walkable = (c: number, r: number) => !solid(s, c, r, pid) || (c === mc && r === mr);
    const bfs = (goal: (c: number, r: number) => boolean, avoid: Set<number>, maxSteps = 40): [number, number] | null => {
      const start = idx(mc, mr);
      const prev = new Map<number, number>([[start, -1]]);
      const q = [start];
      while (q.length) {
        const cur = q.shift()!;
        const c = cur % BB.COLS;
        const r = Math.floor(cur / BB.COLS);
        if (cur !== start && goal(c, r)) {
          let k = cur;
          while (prev.get(k) !== start) k = prev.get(k)!;
          return [k % BB.COLS, Math.floor(k / BB.COLS)];
        }
        if (prev.size > maxSteps * 4) break;
        for (const [dx, dy] of DIRS) {
          const nc = c + dx, nr = r + dy;
          const ni = idx(nc, nr);
          if (prev.has(ni) || !walkable(nc, nr) || avoid.has(ni)) continue;
          if (s.flames.some((f) => f.c === nc && f.r === nr)) continue;
          prev.set(ni, cur);
          q.push(ni);
        }
      }
      return null;
    };
    const toward = (c: number, r: number, b = 0) => {
      const dx = center(c) - me.x;
      const dy = center(r) - me.y;
      const inp = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0, b } : { x: 0, y: Math.sign(dy), b };
      return { input: inp };
    };
    if (danger.has(idx(mc, mr))) {
      const step = bfs((c, r) => !danger.has(idx(c, r)), new Set());
      if (step) return toward(step[0], step[1]);
      return { input: { x: 0, y: 0, b: 0 } };
    }
    // stay centred when idle so lanes line up
    const myBombs = s.bombs.filter((b) => b.owner === pid).length;
    const canBomb = myBombs < me.bombs && !s.bombs.some((b) => b.c === mc && b.r === mr) && !lastJ;
    if (canBomb && ctx.rng.next() < 0.3 + skill * 0.6) {
      const hits = blastCells(s, mc, mr, me.range);
      const crate = hits.some(([c, r]) => s.grid[idx(c, r)] === 2);
      const foe = ctx.ids.some((o) => o !== pid && !s.p[o].out && hits.some(([c, r]) => cellOf(s.p[o].x) === c && cellOf(s.p[o].y) === r));
      if (crate || foe) {
        const extra = new Set(danger);
        for (const [c, r] of hits) extra.add(idx(c, r));
        // only drop it if there's a safe pocket to run to
        const esc = bfs((c, r) => !extra.has(idx(c, r)), new Set(), 8);
        if (esc) {
          s.botJ[pid] = true;
          return { input: { x: 0, y: 0, b: 1 } };
        }
      }
    }
    const foes = ctx.ids.filter((o) => o !== pid && !s.p[o].out).map((o) => idx(cellOf(s.p[o].x), cellOf(s.p[o].y)));
    const step = bfs((c, r) => {
      const i = idx(c, r);
      if (danger.has(i)) return false;
      if (s.items.has(i) && s.grid[i] === 0) return true;
      for (const [dx, dy] of DIRS) if (s.grid[idx(c + dx, r + dy)] === 2) return true;
      return skill > 0.6 && foes.some((f) => Math.abs((f % BB.COLS) - c) + Math.abs(Math.floor(f / BB.COLS) - r) <= 1);
    }, danger);
    if (step) return toward(step[0], step[1]);
    return toward(mc, mr);
  },
  results(s, ctx) {
    const ranked = [...ctx.ids].sort((a, b) => {
      const A = s.p[a], B = s.p[b];
      if (A.out !== B.out) return A.out ? 1 : -1;
      if (A.out && B.out) return B.outAt - A.outAt;
      return B.lives - A.lives || B.kos - A.kos;
    });
    const n = ctx.ids.length;
    const perfs: Record<string, any> = {};
    ranked.forEach((id, i) => {
      const pl = s.p[id];
      perfs[id] = {
        score: (n - i) * 100 + pl.kos * 50 + pl.crates,
        perf: Math.min(1, ((n - 1 - i) / Math.max(1, n - 1)) * 0.65 + Math.min(1, pl.kos / 3) * 0.35),
        participated: ctx.acted(id),
        highlight: `${i === 0 ? '🏆 ' : `#${i + 1} · `}${pl.kos} blast${pl.kos === 1 ? '' : 's'} · ${pl.crates} crates · ${pl.items} power-ups`,
        bonuses: pl.crates >= 15 ? [{ label: 'Demolition crew', pts: 25 }] : [],
      };
    });
    return { perfs };
  },
});
