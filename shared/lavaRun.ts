// Survival Run course: a long horizontal canyon with rocks and gap walls, chased by a lava wall.
// Shared by the server simulation and the client renderer.
import { createRng } from './rng';
import type { Difficulty } from './types';

export const LR = { H: 700, LEN: 9000, R: 25, START_X: 420 } as const;

export interface LavaCourse {
  rocks: { x: number; y: number; r: number }[];
  walls: { x0: number; y0: number; x1: number; y1: number }[];
  /** boulder launch lanes: x where boulders appear rolling left, from when (ms after start) */
  lanes: { x: number; y: number; every: number; from: number }[];
  v0: number;
  acc: number;
  vmax: number;
}

export function makeLavaCourse(seed: number, d: Difficulty): LavaCourse {
  const rng = createRng(seed);
  const c: LavaCourse = { rocks: [], walls: [], lanes: [], v0: d === 'easy' ? 55 : d === 'hard' ? 85 : 70, acc: d === 'easy' ? 2.2 : d === 'hard' ? 3.4 : 2.8, vmax: d === 'easy' ? 190 : d === 'hard' ? 260 : 225 };
  let x = 900;
  while (x < LR.LEN - 300) {
    const r = rng.next();
    if (r < 0.35) {
      // rock garden
      for (let i = 0; i < 5; i++) {
        const rr = 26 + rng.next() * 30;
        c.rocks.push({ x: Math.round(x + rng.next() * 260), y: Math.round(60 + rng.next() * (LR.H - 120)), r: Math.round(rr) });
      }
      x += 380;
    } else if (r < 0.65) {
      // wall with one or two gaps
      const gw = d === 'hard' ? 120 : 140;
      const gaps = rng.chance(0.5) ? [80 + rng.next() * (LR.H - 160)] : [70 + rng.next() * 200, LR.H - 70 - rng.next() * 200];
      let y = 0;
      for (const g of gaps.sort((a, b) => a - b)) {
        if (g - gw / 2 > y) c.walls.push({ x0: Math.round(x), y0: Math.round(y), x1: Math.round(x + 40), y1: Math.round(g - gw / 2) });
        y = g + gw / 2;
      }
      if (y < LR.H) c.walls.push({ x0: Math.round(x), y0: Math.round(y), x1: Math.round(x + 40), y1: LR.H });
      x += 330;
    } else {
      // boulder lane: boulders roll toward the lava along this row
      c.lanes.push({ x: Math.round(x + 420), y: Math.round(80 + rng.next() * (LR.H - 160)), every: Math.round(2600 + rng.next() * 1800), from: 0 });
      x += 300;
    }
  }
  return c;
}

/** Lava front position at `ms` since the start. */
export function lavaX(c: LavaCourse, ms: number): number {
  const t = Math.max(0, ms) / 1000;
  const tCap = (c.vmax - c.v0) / c.acc;
  if (t <= tCap) return c.v0 * t + 0.5 * c.acc * t * t;
  return c.v0 * tCap + 0.5 * c.acc * tCap * tCap + c.vmax * (t - tCap);
}
