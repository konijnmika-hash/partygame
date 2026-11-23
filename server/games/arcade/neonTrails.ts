// Neon Trails: light-cycles on a grid. Every rider leaves a solid neon wall; touch any wall and
// you're out. Trap your rivals! Last rider alive wins each round. Three rounds.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';

export const NT = { COLS: 64, ROWS: 40, CELL: 15 } as const;
const ROUNDS = 3;
const COUNT_MS = 2200;
const BREAK_MS = 2800;
const ROUND_MAX_MS = 45_000;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

interface Rider { x: number; y: number; dir: number; want: number; alive: boolean; pts: number[]; outAt: number; idx: number }

interface S {
  round: number;
  phase: 'count' | 'play' | 'break' | 'over';
  phaseEnds: number;
  grid: number[];
  r: Record<string, Rider>;
  inputs: Record<string, InputFrame>;
  acc: number;
  speed: number;
  outOrder: string[];
  scores: Record<string, number>;
  wins: Record<string, number>;
  winner: string | null;
}

export const neonTrails = defineGame<S>({
  id: 'neon-trails',
  realtime: true,
  botDelay: [70, 120],
  setup(ctx) {
    return {
      round: 0,
      phase: 'count',
      phaseEnds: 0,
      grid: new Array(NT.COLS * NT.ROWS).fill(0),
      r: {},
      inputs: {},
      acc: 0,
      speed: ctx.diff(10, 12, 14),
      outOrder: [],
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      wins: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      winner: null,
    };
  },
  start(s, ctx) {
    startRound(s, ctx);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
    const rd = s.r[pid];
    if (!rd || !rd.alive) return;
    // the stick's dominant axis picks a new heading (no U-turns)
    if (Math.abs(f.x) < 0.4 && Math.abs(f.y) < 0.4) return;
    const d = Math.abs(f.x) >= Math.abs(f.y) ? (f.x > 0 ? 0 : 2) : f.y > 0 ? 1 : 3;
    if (d !== (rd.dir + 2) % 4) rd.want = d;
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
    s.acc += s.speed * dt;
    while (s.acc >= 1 && s.phase === 'play') {
      s.acc -= 1;
      stepAll(s, ctx);
    }
    if (now >= s.phaseEnds && s.phase === 'play') endRound(s, ctx);
  },
  pub(s, ctx) {
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      phaseEnds: s.phaseEnds,
      cols: NT.COLS,
      rows: NT.ROWS,
      riders: ctx.ids.map((id) => {
        const rd = s.r[id];
        return { id, pts: rd.pts, x: rd.x, y: rd.y, a: rd.alive ? 1 : 0, i: rd.idx };
      }),
      winner: s.phase === 'break' ? s.winner : null,
      scores: s.scores,
    };
  },
  bot(s, ctx, pid) {
    const rd = s.r[pid];
    if (s.phase !== 'play' || !rd?.alive) return null;
    const skill = ctx.diff(0.5, 0.75, 0.92);
    // choose the heading with the most open space ahead (small flood fill)
    let best = rd.want;
    let bs = -Infinity;
    for (const turn of [0, 1, 3]) {
      const d = (rd.want + turn) % 4;
      const nx = rd.x + DX[d];
      const ny = rd.y + DY[d];
      const room = free(s, nx, ny) ? space(s, nx, ny, 160) : -1;
      const sc = room + (turn === 0 ? 4 : 0) + (Math.random() - 0.5) * (1 - skill) * 60;
      if (sc > bs) {
        bs = sc;
        best = d;
      }
    }
    const v = best === 0 ? { x: 1, y: 0 } : best === 2 ? { x: -1, y: 0 } : best === 1 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    return { input: { ...v, b: 0 } };
  },
  results(s, ctx) {
    const best = Math.max(1, ...Object.values(s.scores));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / best),
        participated: ctx.acted(id),
        highlight: `${s.wins[id]} round win${s.wins[id] === 1 ? '' : 's'} · ${s.scores[id]} survival points`,
      };
    }
    return { perfs };
  },
});

function free(s: S, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < NT.COLS && y < NT.ROWS && s.grid[y * NT.COLS + x] === 0;
}

function space(s: S, x0: number, y0: number, cap: number): number {
  const seen = new Set<number>([y0 * NT.COLS + x0]);
  const q = [y0 * NT.COLS + x0];
  for (let qi = 0; qi < q.length && seen.size < cap; qi++) {
    const c = q[qi];
    const x = c % NT.COLS;
    const y = Math.floor(c / NT.COLS);
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      const k = ny * NT.COLS + nx;
      if (free(s, nx, ny) && !seen.has(k)) {
        seen.add(k);
        q.push(k);
      }
    }
  }
  return seen.size;
}

function startRound(s: S, ctx: GameCtx) {
  s.grid.fill(0);
  s.outOrder = [];
  s.winner = null;
  s.acc = 0;
  const n = ctx.ids.length;
  ctx.ids.forEach((id, i) => {
    // start around a ring, heading clockwise
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(NT.COLS / 2 + Math.cos(a) * NT.COLS * 0.32);
    const y = Math.round(NT.ROWS / 2 + Math.sin(a) * NT.ROWS * 0.32);
    const dir = Math.abs(Math.cos(a + Math.PI / 2)) > Math.abs(Math.sin(a + Math.PI / 2)) ? (Math.cos(a + Math.PI / 2) > 0 ? 0 : 2) : Math.sin(a + Math.PI / 2) > 0 ? 1 : 3;
    s.r[id] = { x, y, dir, want: dir, alive: true, pts: [x, y], outAt: 0, idx: i + 1 };
    s.grid[y * NT.COLS + x] = i + 1;
  });
  s.phase = 'count';
  s.phaseEnds = ctx.now() + COUNT_MS;
  ctx.dirty();
}

function stepAll(s: S, ctx: GameCtx) {
  const now = ctx.now();
  const alive = ctx.ids.filter((id) => s.r[id].alive);
  const next: Record<string, number> = {};
  for (const id of alive) {
    const rd = s.r[id];
    if (rd.want !== rd.dir) {
      rd.dir = rd.want;
      rd.pts.push(rd.x, rd.y);
    }
    const nx = rd.x + DX[rd.dir];
    const ny = rd.y + DY[rd.dir];
    next[id] = free(s, nx, ny) ? ny * NT.COLS + nx : -1;
  }
  // head-on: two riders entering the same cell both crash
  const counts: Record<number, number> = {};
  for (const k of Object.values(next)) if (k >= 0) counts[k] = (counts[k] ?? 0) + 1;
  for (const id of alive) {
    const rd = s.r[id];
    const k = next[id];
    if (k < 0 || counts[k] > 1) {
      rd.alive = false;
      rd.outAt = now;
      s.outOrder.push(id);
      ctx.event('crash', { id });
      continue;
    }
    rd.x = k % NT.COLS;
    rd.y = Math.floor(k / NT.COLS);
    s.grid[k] = rd.idx;
  }
  for (const id of alive) if (s.r[id].alive) s.scores[id] += 1;
  const left = ctx.ids.filter((id) => s.r[id].alive);
  if ((ctx.ids.length > 1 && left.length <= 1) || left.length === 0) endRound(s, ctx);
}

function endRound(s: S, ctx: GameCtx) {
  const left = ctx.ids.filter((id) => s.r[id].alive);
  s.winner = left.length === 1 ? left[0] : null;
  if (s.winner) {
    s.wins[s.winner]++;
    s.scores[s.winner] += 120;
  }
  // close every polyline at the rider's final cell
  for (const id of ctx.ids) s.r[id].pts.push(s.r[id].x, s.r[id].y);
  s.phase = 'break';
  s.phaseEnds = ctx.now() + BREAK_MS;
  ctx.event('round', { winner: s.winner });
  ctx.dirty();
}
