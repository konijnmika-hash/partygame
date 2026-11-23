// Tiny Obstacle Course: procedurally generated course shared by server (physics) and client
// (rendering). Moving obstacles are pure functions of time so both sides agree.
import { createRng } from './rng';
import type { Difficulty } from './types';

export const OC = { W: 1000, H: 4300, START_Y: 4130, FINISH_Y: 330, R: 26 } as const;

export interface Bumper { x: number; y: number; r: number }
export interface Spinner { x: number; y: number; len: number; th: number; speed: number; phase: number }
export interface Slider { x: number; y: number; hw: number; hh: number; amp: number; speed: number; phase: number }
export interface Wall { x0: number; y0: number; x1: number; y1: number }
export interface Booster { x: number; y: number; r: number }

export interface Course {
  bumpers: Bumper[];
  spinners: Spinner[];
  sliders: Slider[];
  walls: Wall[];
  boosters: Booster[];
  sections: { kind: string; y0: number; y1: number }[];
}

const KINDS = ['bumpers', 'spinner', 'sliders', 'gates', 'twin', 'zigzag'] as const;

export function makeCourse(seed: number, d: Difficulty): Course {
  const rng = createRng(seed);
  const c: Course = { bumpers: [], spinners: [], sliders: [], walls: [], boosters: [], sections: [] };
  const speedK = d === 'easy' ? 0.75 : d === 'hard' ? 1.3 : 1;
  const SEC = 450;
  const n = 8;
  const order: string[] = ['bumpers'];
  const pool = rng.shuffle([...KINDS, ...KINDS]).filter((k) => k !== 'bumpers' || rng.chance(0.5));
  while (order.length < n) {
    const k = pool.shift() ?? KINDS[rng.int(0, KINDS.length - 1)];
    if (k !== order[order.length - 1]) order.push(k);
  }
  let yBottom = OC.START_Y - 200;
  for (let i = 0; i < n; i++) {
    const y1 = yBottom;
    const y0 = yBottom - SEC;
    const yc = (y0 + y1) / 2;
    const kind = order[i];
    c.sections.push({ kind, y0, y1 });
    if (kind === 'bumpers') {
      const placed: Bumper[] = [];
      for (let k = 0; k < 40 && placed.length < 7; k++) {
        const b = { x: 90 + rng.next() * 820, y: y0 + 60 + rng.next() * (SEC - 120), r: 34 + rng.next() * 22 };
        if (placed.every((o) => Math.hypot(o.x - b.x, o.y - b.y) > o.r + b.r + 90)) placed.push(b);
      }
      c.bumpers.push(...placed);
    } else if (kind === 'spinner') {
      c.spinners.push({ x: 500, y: yc, len: 330, th: 13, speed: (rng.chance(0.5) ? 1 : -1) * (1.5 + rng.next() * 0.6) * speedK, phase: rng.next() * 6 });
      c.bumpers.push({ x: 90, y: yc, r: 36 }, { x: 910, y: yc, r: 36 });
    } else if (kind === 'twin') {
      const sp = (1.7 + rng.next() * 0.5) * speedK;
      c.spinners.push({ x: 280, y: yc, len: 190, th: 12, speed: sp, phase: rng.next() * 6 });
      c.spinners.push({ x: 720, y: yc, len: 190, th: 12, speed: -sp, phase: rng.next() * 6 });
    } else if (kind === 'sliders') {
      for (let k = 0; k < 3; k++) {
        c.sliders.push({ x: 500, y: y0 + 90 + k * 135, hw: 150, hh: 20, amp: 330, speed: (0.9 + rng.next() * 0.7) * speedK, phase: rng.next() * 6 });
      }
    } else if (kind === 'gates') {
      const gw = d === 'hard' ? 150 : 175;
      for (const yy of [y0 + 120, y0 + 320]) {
        const g1 = 120 + rng.next() * 260;
        const g2 = 620 + rng.next() * 260;
        addRow(c, yy, [g1, g2], gw);
      }
      c.bumpers.push({ x: 500, y: y0 + 220, r: 44 });
      c.boosters.push({ x: rng.chance(0.5) ? 250 : 750, y: y0 + 220, r: 46 });
    } else if (kind === 'zigzag') {
      // staggered half walls force a weave, with a spinner in the middle lane
      c.walls.push({ x0: 0, y0: y0 + 110, x1: 600, y1: y0 + 140 });
      c.walls.push({ x0: 400, y0: y0 + 310, x1: 1000, y1: y0 + 340 });
      c.spinners.push({ x: 500, y: y0 + 225, len: 150, th: 11, speed: 2.2 * speedK * (rng.chance(0.5) ? 1 : -1), phase: rng.next() * 6 });
      c.boosters.push({ x: 820, y: y0 + 60, r: 42 });
    }
    yBottom = y0;
  }
  return c;
}

function addRow(c: Course, y: number, gaps: number[], gw: number) {
  let x = 0;
  for (const g of gaps.sort((a, b) => a - b)) {
    if (g - gw / 2 > x) c.walls.push({ x0: x, y0: y - 15, x1: g - gw / 2, y1: y + 15 });
    x = g + gw / 2;
  }
  if (x < OC.W) c.walls.push({ x0: x, y0: y - 15, x1: OC.W, y1: y + 15 });
}

/** Spinner bar endpoints at time t (seconds). */
export function spinnerEnds(s: Spinner, t: number): { ax: number; ay: number; bx: number; by: number; a: number } {
  const a = s.phase + s.speed * t;
  const cx = Math.cos(a) * s.len;
  const cy = Math.sin(a) * s.len;
  return { ax: s.x - cx, ay: s.y - cy, bx: s.x + cx, by: s.y + cy, a };
}

/** Slider centre x and velocity at time t (seconds). */
export function sliderAt(s: Slider, t: number): { x: number; vx: number } {
  const a = s.phase + s.speed * t;
  return { x: s.x + Math.sin(a) * s.amp, vx: Math.cos(a) * s.amp * s.speed };
}
