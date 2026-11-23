// Perfect-maze generation (randomised depth-first search) and helpers, shared by the Maze Race
// server and client. Each cell stores its open sides as bits: 1 = north, 2 = east, 4 = south, 8 = west.
import type { Rng } from './rng';

export const DIRS = [
  { bit: 1, dx: 0, dy: -1, opp: 4 },
  { bit: 2, dx: 1, dy: 0, opp: 8 },
  { bit: 4, dx: 0, dy: 1, opp: 1 },
  { bit: 8, dx: -1, dy: 0, opp: 2 },
] as const;

export function makeMaze(rng: Rng, w: number, h: number): number[] {
  const cells = new Array(w * h).fill(0);
  const seen = new Array(w * h).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const x = c % w;
    const y = Math.floor(c / w);
    const opts = DIRS.filter((d) => {
      const nx = x + d.dx;
      const ny = y + d.dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rng.next() * opts.length)];
    const n = (y + d.dy) * w + (x + d.dx);
    cells[c] |= d.bit;
    cells[n] |= d.opp;
    seen[n] = true;
    stack.push(n);
  }
  // a few extra openings make it less linear (more route choices)
  const extra = Math.floor(w * h * 0.06);
  for (let i = 0; i < extra; i++) {
    const c = Math.floor(rng.next() * w * h);
    const x = c % w;
    const y = Math.floor(c / w);
    const d = DIRS[Math.floor(rng.next() * 4)];
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    cells[c] |= d.bit;
    cells[ny * w + nx] |= d.opp;
  }
  return cells;
}

/** BFS distances from a cell (to every cell). */
export function mazeDistances(cells: number[], w: number, h: number, from: number): number[] {
  const dist = new Array(w * h).fill(-1);
  dist[from] = 0;
  const q = [from];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const x = c % w;
    const y = Math.floor(c / w);
    for (const d of DIRS) {
      if (!(cells[c] & d.bit)) continue;
      const n = (y + d.dy) * w + (x + d.dx);
      if (dist[n] < 0) {
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
  }
  return dist;
}

/** The direction index (0..3) from cell c to an adjacent open cell n, or -1. */
export function dirBetween(cells: number[], w: number, c: number, n: number): number {
  const dx = (n % w) - (c % w);
  const dy = Math.floor(n / w) - Math.floor(c / w);
  for (let i = 0; i < 4; i++) if (DIRS[i].dx === dx && DIRS[i].dy === dy && cells[c] & DIRS[i].bit) return i;
  return -1;
}
