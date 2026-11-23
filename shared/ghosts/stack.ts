// Stack the Objects: a block slides over your stack; tap to drop. Overhang is sliced off,
// perfect drops keep (and slowly regrow) the block. Missing completely crumbles the top.
import type { GhostDef } from '../ghost';
import type { Difficulty } from '../types';

export const ST_HZ = 30;
export const ST_BASE_W = 200;
export const ST_RANGE = 260;
/** perfect drop tolerance (world units) */
export const ST_PERFECT = 7;

export interface STWorld {
  speed0: number;
  speedInc: number;
}

export interface STState {
  /** total height (number of placed blocks) */
  h: number;
  /** last few placed blocks: [centre x, width] (older ones no longer matter) */
  top: [number, number][];
  /** moving block */
  mx: number;
  dir: number;
  mw: number;
  perfects: number;
  streak: number;
  best: number;
  misses: number;
  /** ticks of cooldown after a drop */
  cd: number;
  /** last drop result for effects: 0 none, 1 placed, 2 perfect, 3 miss */
  fx: number;
  fxAt: number;
}

const KEEP = 14;

export const stackDef: GhostDef<STWorld, STState> = {
  id: 'stack-objects',
  hz: ST_HZ,
  maxTicks: ST_HZ * 60,
  world(_seed: number, d: Difficulty): STWorld {
    return { speed0: d === 'easy' ? 190 : d === 'hard' ? 290 : 240, speedInc: d === 'easy' ? 5 : d === 'hard' ? 9 : 7 };
  },
  init(): STState {
    return { h: 0, top: [[0, ST_BASE_W]], mx: -ST_RANGE, dir: 1, mw: ST_BASE_W, perfects: 0, streak: 0, best: 0, misses: 0, cd: 0, fx: 0, fxAt: 0 };
  },
  step(w, s, input, prev, tick) {
    const dt = 1 / ST_HZ;
    if (s.cd > 0) {
      s.cd--;
      return;
    }
    const speed = Math.min(620, w.speed0 + w.speedInc * s.h);
    s.mx += s.dir * speed * dt;
    if (s.mx > ST_RANGE) {
      s.mx = ST_RANGE;
      s.dir = -1;
    } else if (s.mx < -ST_RANGE) {
      s.mx = -ST_RANGE;
      s.dir = 1;
    }
    s.mx = Math.round(s.mx * 100) / 100;
    const press = (input[2] & 1) !== 0 && (prev[2] & 1) === 0;
    if (!press) return;
    const [tx, tw] = s.top[s.top.length - 1];
    const dx = s.mx - tx;
    const adx = dx < 0 ? -dx : dx;
    s.fxAt = tick;
    if (adx <= ST_PERFECT) {
      // perfect: snap, keep width, regrow a little on streaks
      s.streak++;
      s.perfects++;
      const grow = s.streak >= 3 ? 8 : 0;
      const nw = Math.min(ST_BASE_W, s.mw + grow);
      s.top.push([tx, nw]);
      s.h++;
      s.mw = nw;
      s.fx = 2;
    } else {
      const overlap = (s.mw + tw) / 2 - adx;
      if (overlap <= 4) {
        // complete miss: the top crumbles
        s.misses++;
        s.streak = 0;
        const lose = Math.min(2, s.top.length - 1);
        for (let i = 0; i < lose; i++) s.top.pop();
        s.h = Math.max(0, s.h - lose);
        s.mw = s.top[s.top.length - 1][1];
        if (s.top.length === 1) s.mw = Math.max(s.mw, 120);
        s.fx = 3;
        s.cd = Math.round(ST_HZ * 0.5);
      } else {
        // slice the overhang
        const left = Math.max(s.mx - s.mw / 2, tx - tw / 2);
        const right = Math.min(s.mx + s.mw / 2, tx + tw / 2);
        const nw = Math.round((right - left) * 100) / 100;
        const nx = Math.round(((left + right) / 2) * 100) / 100;
        s.top.push([nx, nw]);
        s.h++;
        s.mw = nw;
        s.streak = 0;
        s.fx = 1;
      }
    }
    if (s.top.length > KEEP) s.top.shift();
    s.best = Math.max(s.best, s.h);
    // next block starts from alternating sides
    s.dir = s.h % 2 === 0 ? 1 : -1;
    s.mx = s.dir === 1 ? -ST_RANGE : ST_RANGE;
    if (s.cd === 0) s.cd = 3;
  },
  done() {
    return false;
  },
};

export function stackScore(s: STState): number {
  return s.h * 10 + s.perfects * 3;
}

/** Bot: drops when the moving block is close to the top block, with skill-based error. */
export function stackBot(_w: STWorld, s: STState, skill: number, rnd: () => number): [number, number, number] {
  if (s.cd > 0) return [0, 0, 0];
  const [tx] = s.top[s.top.length - 1];
  const dx = s.mx - tx;
  // approaching the target (moving toward it) and within tolerance
  const towards = (dx < 0 && s.dir > 0) || (dx > 0 && s.dir < 0);
  const tol = 10 + (1 - skill) * 45 + rnd() * 10;
  if (Math.abs(dx) < tol && (towards || Math.abs(dx) < 6)) return [0, 0, 1];
  return [0, 0, 0];
}
