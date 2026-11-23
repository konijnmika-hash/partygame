// Obstacle Sprint: an auto-runner. Jump hurdles, slide under bars; hits make you stumble and
// cost a life. Same course for everyone, the distance you cover is your score.
import type { GhostDef, GInput } from '../ghost';
import { createRng } from '../rng';
import type { Difficulty } from '../types';

export const SP_HZ = 30;
export const SP_SECS = 60;
const G = 2600;
const JUMP_V = 900;
const STAND_H = 86;
const SLIDE_H = 38;
const SLIDE_TICKS = 18;
const HALF_W = 20;

export type SPKind = 'hurdle' | 'bar' | 'tall';
export interface SPObstacle { x: number; k: SPKind }

export interface SPWorld {
  obs: SPObstacle[];
  v0: number;
  acc: number;
  vmax: number;
}

export interface SPState {
  x: number;
  y: number;
  vy: number;
  slide: number;
  lives: number;
  inv: number;
  stumble: number;
  next: number;
  cleared: number;
  hits: number;
  out: number;
}

export const SP_SHAPES: Record<SPKind, { hw: number; y0: number; y1: number }> = {
  hurdle: { hw: 16, y0: 0, y1: 52 },
  tall: { hw: 14, y0: 0, y1: 96 },
  bar: { hw: 34, y0: 54, y1: 420 },
};

export function sprintSpeed(w: SPWorld, tick: number): number {
  return Math.min(w.vmax, w.v0 + (w.acc * tick) / SP_HZ);
}

export const sprintDef: GhostDef<SPWorld, SPState> = {
  id: 'obstacle-sprint',
  hz: SP_HZ,
  maxTicks: SP_HZ * SP_SECS,
  world(seed: number, d: Difficulty): SPWorld {
    const rng = createRng(seed);
    const v0 = d === 'easy' ? 300 : d === 'hard' ? 380 : 340;
    const acc = d === 'easy' ? 5 : d === 'hard' ? 8 : 6.5;
    const vmax = d === 'easy' ? 620 : d === 'hard' ? 760 : 690;
    const obs: SPObstacle[] = [];
    // place obstacles in distance space, spaced by time at the nominal speed for that distance
    let x = 900;
    let t = 0;
    let dist = 0;
    while (t < SP_SECS + 5) {
      const v = Math.min(vmax, v0 + acc * t);
      dist += v / SP_HZ;
      t += 1 / SP_HZ;
      if (dist >= x) {
        const r = rng.next();
        const k: SPKind = t < 6 ? (r < 0.6 ? 'hurdle' : 'bar') : r < 0.45 ? 'hurdle' : r < 0.8 ? 'bar' : 'tall';
        obs.push({ x: Math.round(x), k });
        // the gap (in seconds) shrinks over time, but two jumps in a row always leave room to land
        let gapS = Math.max(0.75, 1.9 - t * 0.017) * (0.7 + rng.next() * 0.7);
        const nextIsJumpLikely = k !== 'bar';
        gapS = Math.max(gapS, nextIsJumpLikely ? 0.98 : 0.6);
        x += gapS * v;
      }
    }
    return { obs, v0, acc, vmax };
  },
  init(): SPState {
    return { x: 0, y: 0, vy: 0, slide: 0, lives: 3, inv: 0, stumble: 0, next: 0, cleared: 0, hits: 0, out: 0 };
  },
  step(w, s, input, prev, tick) {
    if (s.out) return;
    const dt = 1 / SP_HZ;
    const grounded = s.y <= 0;
    const jump = ((input[2] & 1) !== 0 && (prev[2] & 1) === 0) || (input[1] < -3 && prev[1] >= -3);
    const slide = ((input[2] & 2) !== 0 && (prev[2] & 2) === 0) || (input[1] > 3 && prev[1] <= 3);
    if (jump && grounded && s.stumble === 0) {
      s.vy = JUMP_V;
      s.slide = 0;
    } else if (slide) {
      if (grounded) s.slide = SLIDE_TICKS;
      else s.vy = Math.min(s.vy, -JUMP_V); // fast-fall into a slide
    }
    if (!grounded || s.vy > 0) {
      s.vy -= G * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) {
        s.y = 0;
        s.vy = 0;
        if (slide || input[1] > 3) s.slide = SLIDE_TICKS;
      }
    }
    if (s.slide > 0) s.slide--;
    if (s.inv > 0) s.inv--;
    if (s.stumble > 0) s.stumble--;
    const speed = sprintSpeed(w, tick) * (s.stumble > 0 ? 0.55 : 1);
    s.x += speed * dt;
    // collisions with the obstacles around us
    const h = s.slide > 0 ? SLIDE_H : STAND_H;
    while (s.next < w.obs.length && w.obs[s.next].x + SP_SHAPES[w.obs[s.next].k].hw < s.x - HALF_W) {
      s.next++;
      s.cleared++;
    }
    for (let i = s.next; i < w.obs.length && w.obs[i].x - 60 < s.x; i++) {
      const o = w.obs[i];
      const sh = SP_SHAPES[o.k];
      if (s.x + HALF_W < o.x - sh.hw || s.x - HALF_W > o.x + sh.hw) continue;
      if (s.y + h <= sh.y0 || s.y >= sh.y1) continue;
      if (s.inv > 0) continue;
      s.lives--;
      s.hits++;
      s.inv = Math.round(SP_HZ * 1.2);
      s.stumble = Math.round(SP_HZ * 0.7);
      if (s.lives <= 0) s.out = tick + 1;
    }
    s.x = Math.round(s.x * 100) / 100;
    s.y = Math.round(s.y * 100) / 100;
    s.vy = Math.round(s.vy * 100) / 100;
  },
  done(_w, s) {
    return s.out > 0;
  },
};

export function sprintBot(w: SPWorld, s: SPState, tick: number, skill: number, rnd: () => number): GInput {
  const o = w.obs[s.next];
  if (!o) return [0, 0, 0];
  const v = sprintSpeed(w, tick) * (s.stumble > 0 ? 0.55 : 1);
  const tta = (o.x - SP_SHAPES[o.k].hw - (s.x + HALF_W)) / v;
  const err = (rnd() - 0.5) * (1 - skill) * 0.6;
  if (o.k === 'bar') {
    if (s.slide > 3) return [0, 0, 0];
    return tta < 0.24 + err && tta > 0.0 ? [0, 8, 0] : [0, 0, 0];
  }
  const lo = o.k === 'tall' ? 0.14 : 0.07;
  return tta < 0.28 + err && tta > lo + err * 0.3 && s.y <= 0 ? [0, -8, 1] : [0, 0, 0];
}
