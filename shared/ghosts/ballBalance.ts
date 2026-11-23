// Ball Balance: tilt your plate to keep the ball on it while the plate shrinks and gusts blow.
import type { GhostDef } from '../ghost';
import { createRng } from '../rng';
import { dcos, dsin } from '../dmath';
import type { Difficulty } from '../types';

export const BB_HZ = 30;
/** golden centre ring as a fraction of the plate radius */
export const BB_RING = 0.3;

export interface BBWorld {
  gusts: { at: number; len: number; dx: number; dy: number }[];
  r0: number;
  rMin: number;
  shrink: number;
  accel: number;
  /** slow plate wobble that grows over time */
  wob: { amp: number; fx: number; fy: number; px: number; py: number };
}

export interface BBState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alive: boolean;
  t: number;
  /** survival points: +1 per tick alive, +1 extra inside the golden centre ring */
  pts: number;
  centre: number;
}

export const ballBalanceDef: GhostDef<BBWorld, BBState> = {
  id: 'ball-balance',
  hz: BB_HZ,
  maxTicks: BB_HZ * 60,
  world(seed: number, d: Difficulty): BBWorld {
    const rng = createRng(seed);
    const gusts: BBWorld['gusts'] = [];
    let t = BB_HZ * 4;
    while (t < BB_HZ * 60) {
      const a = rng.next() * 6.283185307179586;
      const s = (d === 'easy' ? 140 : d === 'hard' ? 250 : 190) * (0.6 + rng.next() * 0.8) * (1 + t / (BB_HZ * 120));
      const len = Math.round(BB_HZ * (0.7 + rng.next() * 1.3));
      gusts.push({ at: t, len, dx: Math.round(dcos(a) * s), dy: Math.round(dsin(a) * s) });
      t += Math.round(BB_HZ * (d === 'easy' ? 3.6 : d === 'hard' ? 2.2 : 2.8) * (0.7 + rng.next() * 0.6));
    }
    const wob = { amp: d === 'easy' ? 60 : d === 'hard' ? 120 : 90, fx: 0.9 + rng.next() * 0.6, fy: 1.1 + rng.next() * 0.6, px: rng.next() * 6, py: rng.next() * 6 };
    return { gusts, r0: 270, rMin: d === 'easy' ? 90 : d === 'hard' ? 60 : 72, shrink: d === 'easy' ? 2.8 : d === 'hard' ? 3.6 : 3.2, accel: 600, wob };
  },
  init(): BBState {
    return { x: 0, y: 0, vx: 0, vy: 0, r: 270, alive: true, t: 0, pts: 0, centre: 0 };
  },
  step(w, s, input, _prev, tick) {
    if (!s.alive) return;
    const dt = 1 / BB_HZ;
    s.t = tick + 1;
    s.r = Math.max(w.rMin, w.r0 - (w.shrink * tick) / BB_HZ);
    // tilt -> acceleration
    let ax = (input[0] / 8) * w.accel;
    let ay = (input[1] / 8) * w.accel;
    for (const g of w.gusts) {
      if (tick >= g.at && tick < g.at + g.len) {
        ax += g.dx;
        ay += g.dy;
      }
    }
    const sec = tick / BB_HZ;
    const wa = w.wob.amp * Math.min(1, sec / 40);
    ax += wa * dsin(sec * w.wob.fx + w.wob.px);
    ay += wa * dsin(sec * w.wob.fy + w.wob.py);
    s.vx = (s.vx + ax * dt) * 0.99;
    s.vy = (s.vy + ay * dt) * 0.99;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const d = Math.sqrt(s.x * s.x + s.y * s.y);
    if (d > s.r) s.alive = false;
    else {
      s.pts++;
      if (d < s.r * BB_RING) {
        s.pts++;
        s.centre++;
      }
    }
    s.x = Math.round(s.x * 100) / 100;
    s.y = Math.round(s.y * 100) / 100;
    s.vx = Math.round(s.vx * 100) / 100;
    s.vy = Math.round(s.vy * 100) / 100;
  },
  done(_w, s) {
    return !s.alive;
  },
};

/** Active gust (for rendering arrows). */
export function gustAt(w: BBWorld, tick: number): { dx: number; dy: number } | null {
  for (const g of w.gusts) if (tick >= g.at - 20 && tick < g.at + g.len) return g;
  return null;
}

/** PD-controller bot: skill 0..1 scales gains, noise and attention. */
export function balanceBot(w: BBWorld, s: BBState, tick: number, skill: number, rnd: () => number): [number, number, number] {
  // inattentive moments
  if (rnd() > 0.93 + skill * 0.065) return [0, 0, 0];
  const kp = 2.2 + skill * 1.6;
  const kd = 1.6 + skill * 0.8;
  let ax = -(kp * s.x + kd * s.vx);
  let ay = -(kp * s.y + kd * s.vy);
  // anticipate visible gusts a little
  const g = gustAt(w, tick);
  if (g && skill > 0.6) {
    ax -= g.dx * 0.8;
    ay -= g.dy * 0.8;
  }
  const noise = (1 - skill) * 3;
  const qx = Math.round((ax / w.accel) * 8 + (rnd() - 0.5) * noise);
  const qy = Math.round((ay / w.accel) * 8 + (rnd() - 0.5) * noise);
  return [Math.max(-8, Math.min(8, qx)), Math.max(-8, Math.min(8, qy)), 0];
}
