// Reflex Maze: run along a twisting corridor; queue the next turn before each corner.
import type { GhostDef, GInput } from '../ghost';
import { createRng } from '../rng';
import type { Difficulty } from '../types';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export interface RMWorld {
  pts: { x: number; y: number }[]; // corner points (cell units)
  dirs: number[]; // direction of segment i (pts[i] -> pts[i+1])
  lens: number[];
  base: number;
  accel: number;
}

export interface RMState {
  seg: number;
  d: number;
  lives: number;
  queued: number;
  pause: number;
  dist: number;
  crashes: number;
  turns: number;
}

export const HZ = 30;

export function inputDir(i: GInput): number {
  const [x, y] = i;
  if (Math.abs(x) >= Math.abs(y) && Math.abs(x) >= 4) return x > 0 ? 0 : 2;
  if (Math.abs(y) >= 4) return y > 0 ? 1 : 3;
  return -1;
}

export const reflexMazeDef: GhostDef<RMWorld, RMState> = {
  id: 'reflex-maze',
  hz: HZ,
  maxTicks: HZ * 60,
  world(seed: number, difficulty: Difficulty): RMWorld {
    const rng = createRng(seed);
    const pts = [{ x: 0, y: 0 }];
    const dirs: number[] = [];
    const lens: number[] = [];
    let dir = 0;
    for (let i = 0; i < 160; i++) {
      const len = rng.int(2, 5);
      const last = pts[pts.length - 1];
      pts.push({ x: last.x + DX[dir] * len, y: last.y + DY[dir] * len });
      dirs.push(dir);
      lens.push(len);
      dir = (dir + (rng.chance(0.5) ? 1 : 3)) % 4;
    }
    return { pts, dirs, lens, base: difficulty === 'easy' ? 2.4 : difficulty === 'hard' ? 3.4 : 2.9, accel: difficulty === 'easy' ? 0.03 : difficulty === 'hard' ? 0.05 : 0.04 };
  },
  init(): RMState {
    return { seg: 0, d: 0, lives: 3, queued: -1, pause: 0, dist: 0, crashes: 0, turns: 0 };
  },
  step(w, s, input, prev, tick) {
    const di = inputDir(input);
    if (di >= 0 && di !== inputDir(prev)) s.queued = di;
    if (s.pause > 0) {
      s.pause--;
      return;
    }
    const speed = w.base + w.accel * (tick / HZ);
    const stepLen = speed / HZ;
    s.d += stepLen;
    s.dist += stepLen;
    const len = w.lens[s.seg];
    if (s.d >= len) {
      const nextDir = w.dirs[s.seg + 1];
      if (s.queued === nextDir) {
        s.d -= len;
        s.seg++;
        s.turns++;
      } else {
        s.lives--;
        s.crashes++;
        s.d = 0;
        s.seg++;
        s.pause = HZ; // dazed for a second
      }
      s.queued = -1;
    }
    s.dist = Math.round(s.dist * 1000) / 1000;
    s.d = Math.round(s.d * 1000) / 1000;
  },
  done(w, s) {
    return s.lives <= 0 || s.seg >= w.dirs.length - 2;
  },
};

/** Position (cell units) of a state along the path. */
export function rmPos(w: RMWorld, s: RMState): { x: number; y: number; dir: number } {
  const p = w.pts[s.seg];
  const dir = w.dirs[s.seg];
  return { x: p.x + DX[dir] * s.d, y: p.y + DY[dir] * s.d, dir };
}
