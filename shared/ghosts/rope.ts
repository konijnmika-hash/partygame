// Jump Challenge: a giant rope swings round; jump as it passes under you. The speed keeps
// changing and double ropes appear. Three misses and you are out.
import type { GhostDef, GInput } from '../ghost';
import { createRng } from '../rng';
import type { Difficulty } from '../types';

export const RP_HZ = 30;
export const RP_SECS = 60;
const G = 2200;
const JUMP_V = 540;
/** height the rope needs to pass under you */
export const RP_CLEAR = 14;
/** clearing the rope this high counts as perfect timing */
export const RP_PERFECT = 52;
const TWO_PI = 6.283185307179586;

export interface RPWorld {
  /** rope angle per tick (0 = top, PI = bottom) */
  phase: number[];
  /** ticks where a rope passes the bottom */
  cross: number[];
  /** whether a second rope (half a turn behind) is swinging at each tick */
  dbl: number[];
}

export interface RPState {
  y: number;
  vy: number;
  lives: number;
  stun: number;
  ci: number;
  cleared: number;
  /** clears with the rope passing near the top of the jump */
  perfect: number;
  misses: number;
  streak: number;
  best: number;
  out: number;
  /** tick of the last miss (for effects) */
  missAt: number;
}

export const ropeDef: GhostDef<RPWorld, RPState> = {
  id: 'jump-challenge',
  hz: RP_HZ,
  maxTicks: RP_HZ * RP_SECS,
  world(seed: number, d: Difficulty): RPWorld {
    const rng = createRng(seed);
    const T = RP_HZ * RP_SECS + RP_HZ * 2;
    const phase: number[] = [];
    const cross: number[] = [];
    const dbl: number[] = [];
    const maxRate = d === 'easy' ? 1.0 : d === 'hard' ? 1.35 : 1.18;
    let rate = 0.5;
    let target = 0.55;
    let nextChange = RP_HZ * 5;
    let dblUntil = -1;
    let th = 0.4;
    for (let t = 0; t < T; t++) {
      if (t >= nextChange) {
        const prog = t / (RP_HZ * RP_SECS);
        const base = 0.55 + prog * (maxRate - 0.55);
        const r = rng.next();
        // surprises: sudden bursts and slow-downs keep the rhythm unpredictable
        target = r < 0.15 ? Math.min(maxRate, base + 0.3) : r < 0.3 ? Math.max(0.45, base - 0.2) : base;
        if (t > RP_HZ * 22 && dblUntil < t && rng.chance(0.35)) dblUntil = t + RP_HZ * (5 + rng.int(0, 3));
        nextChange = t + RP_HZ * (4 + rng.int(0, 4));
      }
      const tgt = dblUntil >= t ? Math.min(target, 0.8) : target;
      rate += (tgt - rate) * 0.04;
      const prev = th;
      th += (TWO_PI * rate) / RP_HZ;
      const isDbl = dblUntil >= t ? 1 : 0;
      // rope 1 at the bottom when th crosses PI (mod 2PI); rope 2 when it crosses 0
      const a = prev % TWO_PI;
      const b = a + (th - prev);
      if (a < Math.PI && b >= Math.PI) cross.push(t);
      else if (isDbl && a < TWO_PI && b >= TWO_PI) cross.push(t);
      if (th > TWO_PI * 1000) th -= TWO_PI * 1000;
      phase.push(Math.round(th * 10000) / 10000);
      dbl.push(isDbl);
    }
    return { phase, cross, dbl };
  },
  init(): RPState {
    return { y: 0, vy: 0, lives: 3, stun: 0, ci: 0, cleared: 0, perfect: 0, misses: 0, streak: 0, best: 0, out: 0, missAt: -100 };
  },
  step(w, s, input, prev, tick) {
    if (s.out) return;
    const dt = 1 / RP_HZ;
    const jump = ((input[2] & 1) !== 0 && (prev[2] & 1) === 0) || (input[1] < -3 && prev[1] >= -3);
    if (s.stun > 0) s.stun--;
    if (jump && s.y <= 0 && s.stun === 0) s.vy = JUMP_V;
    if (s.y > 0 || s.vy > 0) {
      s.vy -= G * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) {
        s.y = 0;
        s.vy = 0;
      }
    }
    while (s.ci < w.cross.length && w.cross[s.ci] < tick) s.ci++;
    if (w.cross[s.ci] === tick) {
      s.ci++;
      if (s.y > RP_CLEAR) {
        s.cleared++;
        if (s.y > RP_PERFECT) s.perfect++;
        s.streak++;
        if (s.streak > s.best) s.best = s.streak;
      } else {
        s.misses++;
        s.lives--;
        s.streak = 0;
        s.stun = Math.round(RP_HZ * 0.45);
        s.missAt = tick;
        if (s.lives <= 0) s.out = tick + 1;
      }
    }
    s.y = Math.round(s.y * 100) / 100;
    s.vy = Math.round(s.vy * 100) / 100;
  },
  done(_w, s) {
    return s.out > 0;
  },
};

export function ropeBot(w: RPWorld, s: RPState, tick: number, skill: number, rnd: () => number): GInput {
  let ci = s.ci;
  while (ci < w.cross.length && w.cross[ci] < tick) ci++;
  const c = w.cross[ci];
  if (c == null || s.y > 0) return [0, 0, 0];
  const tta = (c - tick) / RP_HZ;
  const err = (rnd() - 0.5) * (1 - skill) * 0.4;
  return tta > 0.08 + err && tta < 0.32 + err ? [0, -8, 1] : [0, 0, 0];
}
