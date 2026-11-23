// Physics Puzzle Race: deterministic ball-and-ramps simulation shared by server (validation)
// and client (animation), plus a level generator that only emits levels it has solved itself.
import type { Rng } from './rng';
import { dcos, dsin } from './dmath';

export const PZ = { W: 800, H: 600, R: 11, RAMP: 150, G: 900, HZ: 120, MAX_STEPS: 120 * 9, STEP_DEG: 15, MAX_A: 6 } as const;

export interface Seg { ax: number; ay: number; bx: number; by: number }
/** a ramp: centre + angle index (angle = a * 15°, positive = clockwise / right side down) */
export type Ramp = [number, number, number];

export interface PuzzleLevel {
  start: { x: number; y: number };
  goal: { x: number; y: number; w: number; h: number };
  walls: Seg[];
  ramps: number;
}

export interface SimResult {
  ok: boolean;
  reason: 'goal' | 'out' | 'timeout' | 'stuck';
  steps: number;
  /** sampled ball positions (every 2 steps) when recording */
  path?: number[];
}

export function rampSeg(r: Ramp): Seg {
  const th = (r[2] * PZ.STEP_DEG * Math.PI) / 180;
  const hx = dcos(th) * (PZ.RAMP / 2);
  const hy = dsin(th) * (PZ.RAMP / 2);
  return { ax: r[0] - hx, ay: r[1] - hy, bx: r[0] + hx, by: r[1] + hy };
}

export function validRamp(r: unknown): r is Ramp {
  return (
    Array.isArray(r) && r.length === 3 &&
    Number.isInteger(r[0]) && Number.isInteger(r[1]) && Number.isInteger(r[2]) &&
    r[0] >= 30 && r[0] <= PZ.W - 30 && r[1] >= 70 && r[1] <= PZ.H - 20 && Math.abs(r[2]) <= PZ.MAX_A
  );
}

/** Run the ball. Only + - * / and sqrt, so every JS engine produces the same result. */
export function simulate(level: PuzzleLevel, ramps: Ramp[], record = false): SimResult {
  const segs = level.walls.concat(ramps.map(rampSeg));
  const dt = 1 / PZ.HZ;
  const R = PZ.R;
  let x = level.start.x;
  let y = level.start.y;
  let vx = 0;
  let vy = 0;
  let slow = 0;
  const path: number[] | undefined = record ? [x, y] : undefined;
  const g = level.goal;
  for (let step = 1; step <= PZ.MAX_STEPS; step++) {
    vy += PZ.G * dt;
    x += vx * dt;
    y += vy * dt;
    for (let pass = 0; pass < 2; pass++) {
      for (const s of segs) {
        const ex = s.bx - s.ax;
        const ey = s.by - s.ay;
        const l2 = ex * ex + ey * ey;
        let k = l2 > 0 ? ((x - s.ax) * ex + (y - s.ay) * ey) / l2 : 0;
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        const qx = s.ax + ex * k;
        const qy = s.ay + ey * k;
        const dx = x - qx;
        const dy = y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2);
        let nx: number;
        let ny: number;
        if (d < 1e-6) {
          // exactly on the line: use the segment normal pointing up
          const l = Math.sqrt(l2) || 1;
          nx = ey / l;
          ny = -ex / l;
          if (ny > 0) {
            nx = -nx;
            ny = -ny;
          }
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        x = qx + nx * R;
        y = qy + ny * R;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          const tx = vx - vn * nx;
          const ty = vy - vn * ny;
          const bounce = vn < -120 ? 0.35 : 0;
          vx = tx * 0.997 - vn * bounce * nx;
          vy = ty * 0.997 - vn * bounce * ny;
        }
      }
    }
    if (path && step % 2 === 0) path.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    if (x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h) return { ok: true, reason: 'goal', steps: step, path };
    if (y > PZ.H + 40 || x < -40 || x > PZ.W + 40 || y < -400) return { ok: false, reason: 'out', steps: step, path };
    if (vx * vx + vy * vy < 400) {
      if (++slow > PZ.HZ) return { ok: false, reason: 'stuck', steps: step, path };
    } else slow = 0;
  }
  return { ok: false, reason: 'timeout', steps: PZ.MAX_STEPS, path };
}

function cupWalls(goal: PuzzleLevel['goal']): Seg[] {
  const { x, y, w, h } = goal;
  return [
    { ax: x, ay: y, bx: x, by: y + h },
    { ax: x + w, ay: y, bx: x + w, by: y + h },
    { ax: x, ay: y + h, bx: x + w, by: y + h },
  ];
}

function segPointDist(s: Seg, px: number, py: number): number {
  const ex = s.bx - s.ax;
  const ey = s.by - s.ay;
  const l2 = ex * ex + ey * ey || 1;
  let k = ((px - s.ax) * ex + (py - s.ay) * ey) / l2;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  const dx = px - (s.ax + ex * k);
  const dy = py - (s.ay + ey * k);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build a solvable level: chain ramps along the ball's flight, drop a cup where the ball ends
 * up, verify the solution, verify that no-ramp / random attempts fail, then add obstacles that
 * keep the solution path clear.
 */
export function generateLevel(rng: Rng, rampCount: number): { level: PuzzleLevel; solution: Ramp[] } {
  for (let attempt = 0; attempt < 400; attempt++) {
    const start = { x: Math.round(130 + rng.next() * 540), y: 40 };
    const level: PuzzleLevel = { start, goal: { x: -999, y: -999, w: 0, h: 0 }, walls: [], ramps: rampCount };
    const sol: Ramp[] = [];
    let ok = true;
    for (let i = 0; i < rampCount && ok; i++) {
      const sim = simulate(level, sol, true);
      const path = sim.path!;
      // pick a point on the current flight to intercept
      const cands: number[] = [];
      const yMin = 130 + i * 110;
      const yMax = Math.min(PZ.H - 170, yMin + 220);
      // only intercept after the ball has left the previous ramp
      let from = 0;
      if (sol.length) {
        const last = sol[sol.length - 1];
        let bd = Infinity;
        for (let q = 0; q < path.length; q += 2) {
          const d = (path[q] - last[0]) ** 2 + (path[q + 1] - last[1]) ** 2;
          if (d < bd) {
            bd = d;
            from = q;
          }
        }
        from += 16;
      }
      for (let k = from; k < path.length; k += 2) {
        const px = path[k];
        const py = path[k + 1];
        if (py > yMin && py < yMax && px > 110 && px < PZ.W - 110) cands.push(k);
      }
      if (!cands.length) {
        ok = false;
        break;
      }
      const k = cands[rng.int(0, cands.length - 1)];
      const px = path[k];
      const py = path[k + 1];
      const vx = path[Math.min(path.length - 2, k + 2)] - path[Math.max(0, k - 2)];
      // tilt to send the ball away from its current horizontal drift (or a random side)
      const dir = Math.abs(vx) < 1 ? (rng.chance(0.5) ? 1 : -1) : vx > 0 ? -1 : 1;
      const mag = rng.int(1, 3);
      const offset = rng.int(-30, 30);
      sol.push([Math.round(px + offset), Math.round(py + PZ.R + 4), dir * mag]);
    }
    if (!ok) continue;
    const flight = simulate(level, sol, true);
    const fp = flight.path!;
    // the cup goes where the finished flight passes, low on the board, falling
    const spots: number[] = [];
    for (let k = 4; k < fp.length; k += 2) {
      const px = fp[k];
      const py = fp[k + 1];
      const fall = py - fp[k - 1];
      if (py > PZ.H - 210 && py < PZ.H - 90 && px > 90 && px < PZ.W - 90 && fall > 2) spots.push(k);
    }
    if (!spots.length) continue;
    const k = spots[rng.int(0, spots.length - 1)];
    const cw = 92;
    const ch = 54;
    const gx = Math.round(fp[k] - cw / 2 + rng.int(-12, 12));
    const gy = Math.round(fp[k + 1] + 4);
    if (gy + ch > PZ.H - 10) continue;
    level.goal = { x: gx, y: gy, w: cw, h: ch };
    level.walls = cupWalls(level.goal);
    // goal must be far from the straight drop so the puzzle is not trivial
    if (Math.abs(gx + cw / 2 - start.x) < 170) continue;
    if (!simulate(level, sol).ok) continue;
    if (simulate(level, []).ok) continue;
    // obstacles that keep the solution path clear
    const solPath = simulate(level, sol, true).path!;
    const solSegs = sol.map(rampSeg);
    const clear = (s: Seg) => {
      for (let q = 0; q < solPath.length; q += 2) if (segPointDist(s, solPath[q], solPath[q + 1]) < 34) return false;
      for (const r of solSegs) for (const t of [0, 0.5, 1]) if (segPointDist(s, r.ax + (r.bx - r.ax) * t, r.ay + (r.by - r.ay) * t) < 30) return false;
      if (segPointDist(s, gx + cw / 2, gy + ch / 2) < 80) return false;
      return true;
    };
    const extra: Seg[] = [];
    // a blocker under the start makes the direct drop useless
    for (let tries = 0; tries < 60 && extra.length < 1; tries++) {
      const yy = 260 + rng.next() * 160;
      const len = 120 + rng.next() * 100;
      const s: Seg = { ax: start.x - len / 2, ay: yy, bx: start.x + len / 2, by: yy + (rng.next() - 0.5) * 40 };
      if (clear(s)) extra.push(roundSeg(s));
    }
    for (let tries = 0; tries < 80 && extra.length < 4; tries++) {
      const cx = 80 + rng.next() * (PZ.W - 160);
      const cy = 160 + rng.next() * (PZ.H - 220);
      const len = 70 + rng.next() * 110;
      const a = (rng.int(-4, 4) * 15 * Math.PI) / 180;
      const s: Seg = { ax: cx - (Math.cos(a) * len) / 2, ay: cy - (Math.sin(a) * len) / 2, bx: cx + (Math.cos(a) * len) / 2, by: cy + (Math.sin(a) * len) / 2 };
      if (clear(s)) extra.push(roundSeg(s));
    }
    const final: PuzzleLevel = { ...level, walls: [...level.walls, ...extra] };
    if (!simulate(final, sol).ok || simulate(final, []).ok) continue;
    // random placements should almost never work
    let lucky = 0;
    for (let t = 0; t < 12; t++) {
      const rr: Ramp[] = [];
      for (let i = 0; i < rampCount; i++) rr.push([rng.int(60, PZ.W - 60), rng.int(120, PZ.H - 60), rng.int(-PZ.MAX_A, PZ.MAX_A)]);
      if (simulate(final, rr).ok) lucky++;
    }
    if (lucky > 1) continue;
    return { level: final, solution: sol };
  }
  // fallback (practically unreachable): a simple one-ramp level
  const level: PuzzleLevel = { start: { x: 200, y: 40 }, goal: { x: 520, y: 470, w: 92, h: 54 }, walls: cupWalls({ x: 520, y: 470, w: 92, h: 54 }), ramps: 1 };
  return { level, solution: [[220, 300, -3]] };
}

function roundSeg(s: Seg): Seg {
  return { ax: Math.round(s.ax), ay: Math.round(s.ay), bx: Math.round(s.bx), by: Math.round(s.by) };
}
