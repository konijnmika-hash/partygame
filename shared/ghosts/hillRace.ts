// Mini Physics Race: a hill car with real airtime. On the ground too much gas on a slope pops a
// wheelie (and flips you); in the air GAS tilts the nose up and BRAKE tilts it down — land on
// your wheels or crash.
import type { GhostDef } from '../ghost';
import { createRng } from '../rng';
import { dcos, dsin } from '../dmath';
import type { Difficulty } from '../types';

export const HR_HZ = 30;
export const HR_LEN = 9000;
/** wheelie angle that flips the car */
export const HR_FLIP_AT = 1.0;
/** worst landing angle (relative to the ground) that still lands */
export const HR_LAND_MAX = 0.95;
export const HR_CAR_H = 20;
const G = 520;
const ROT = 10;

export interface HRWorld {
  waves: { amp: number; freq: number; phase: number }[];
  /** jump humps: centre, half-width, height */
  humps: { c: number; l: number; h: number }[];
  power: number;
  /** distance markers for decoration */
  flags: number[];
}

export interface HRState {
  x: number;
  y: number;
  /** speed along the ground (when grounded) */
  v: number;
  /** air velocity (when airborne) */
  vx: number;
  vy: number;
  air: number;
  /** absolute body angle (radians, + = nose up) */
  a: number;
  /** wheelie angle relative to the ground and its angular velocity */
  pitch: number;
  spin: number;
  /** angular velocity while airborne */
  av: number;
  /** ticks left in a crash recovery */
  flipped: number;
  flips: number;
  perfect: number;
  airTicks: number;
  /** tick of finish (0 = not yet) */
  finished: number;
}

/** Deterministic arctangent (minimax polynomial, |err| < 1e-4 rad). */
export function datan(z: number): number {
  const sign = z < 0 ? -1 : 1;
  let x = Math.abs(z);
  let inv = false;
  if (x > 1) {
    x = 1 / x;
    inv = true;
  }
  const x2 = x * x;
  let r = x * (0.999866 + x2 * (-0.3302995 + x2 * (0.180141 + x2 * (-0.085133 + x2 * 0.0208351))));
  if (inv) r = 1.5707963267948966 - r;
  return sign * r;
}

function rawHeight(waves: HRWorld['waves'], x: number): number {
  let h = 0;
  for (const wv of waves) h += wv.amp * dsin(x * wv.freq + wv.phase);
  return h;
}

function humpHeight(humps: HRWorld['humps'], x: number): number {
  for (const hp of humps) {
    const u = (x - hp.c) / hp.l;
    if (u > -1 && u < 1) return hp.h * 0.5 * (1 + dcos(u * 3.141592653589793));
  }
  return 0;
}

/** Ground height (screen-space y, smaller = higher) at track position x. */
export function groundY(w: HRWorld, x: number): number {
  const ramp = x < 300 ? 0 : Math.min(1, (x - 300) / 500);
  return 420 - rawHeight(w.waves, x) * ramp - humpHeight(w.humps, x);
}

/** Ground angle at x in radians (+ = uphill). */
export function slopeAt(w: HRWorld, x: number): number {
  const d = 6;
  return datan((groundY(w, x - d) - groundY(w, x + d)) / (2 * d));
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function crash(s: HRState): void {
  s.flipped = Math.round(HR_HZ * 1.5);
  s.flips++;
  s.v = 0;
  s.vx = 0;
  s.vy = 0;
  s.av = 0;
}

export const hillRaceDef: GhostDef<HRWorld, HRState> = {
  id: 'physics-race',
  hz: HR_HZ,
  maxTicks: HR_HZ * 75,
  world(seed: number, d: Difficulty): HRWorld {
    const rng = createRng(seed);
    const waves = [
      { amp: 120, freq: 0.0031 + rng.next() * 0.0008, phase: rng.next() * 6 },
      { amp: 55, freq: 0.0085 + rng.next() * 0.002, phase: rng.next() * 6 },
      { amp: 22, freq: 0.019 + rng.next() * 0.004, phase: rng.next() * 6 },
    ];
    // normalise so the steepest slope matches the difficulty (always climbable with care)
    let maxD = 0;
    for (let x = 0; x < HR_LEN + 400; x += 5) {
      const dd = Math.abs(rawHeight(waves, x + 2.5) - rawHeight(waves, x - 2.5)) / 5;
      if (dd > maxD) maxD = dd;
    }
    const target = d === 'easy' ? 0.34 : d === 'hard' ? 0.5 : 0.42; // tan(max slope)
    const k = maxD > 0 ? target / maxD : 1;
    for (const wv of waves) wv.amp = Math.round(wv.amp * k * 100) / 100;
    const humps: HRWorld['humps'] = [];
    const hk = d === 'easy' ? 0.8 : d === 'hard' ? 1.15 : 1;
    for (let c = 1100 + rng.next() * 400; c < HR_LEN - 500; c += 800 + rng.next() * 700) {
      const l = Math.round(65 + rng.next() * 30);
      humps.push({ c: Math.round(c), l, h: Math.round(Math.min(0.5 * l, (26 + rng.next() * 14) * hk)) });
    }
    const flags: number[] = [];
    for (let x = 1000; x < HR_LEN; x += 1000) flags.push(x);
    return { waves, humps, power: 480, flags };
  },
  init(w): HRState {
    const x = 60;
    return { x, y: groundY(w, x) - HR_CAR_H, v: 0, vx: 0, vy: 0, air: 0, a: 0, pitch: 0, spin: 0, av: 0, flipped: 0, flips: 0, perfect: 0, airTicks: 0, finished: 0 };
  },
  step(w, s, input, _prev, tick) {
    if (s.finished) return;
    const dt = 1 / HR_HZ;
    if (s.flipped > 0) {
      s.flipped--;
      if (s.flipped === 0) {
        // respawn on a gentle spot a little behind the crash so the run-up is fair
        let x = s.x;
        for (let i = 0; i < 40 && x > 60; i++) {
          const th = slopeAt(w, x);
          if (th < 0.18 && th > -0.18) break;
          x -= 10;
        }
        s.x = Math.max(60, x);
        s.air = 0;
        s.y = groundY(w, s.x) - HR_CAR_H;
        s.pitch = 0;
        s.spin = 0;
        s.a = slopeAt(w, s.x);
      }
      return;
    }
    const gas = (input[2] & 1) !== 0 || input[0] > 3 || input[1] < -3 ? 1 : 0;
    const brake = !gas && (input[0] < -3 || input[1] > 3 || (input[2] & 2) !== 0) ? 1 : 0;
    if (!s.air) {
      const th = slopeAt(w, s.x);
      const sn = dsin(th);
      const cs = dcos(th);
      // along the ground: engine, gravity, rolling drag, brakes
      let acc = gas * w.power - G * sn - 1.05 * s.v;
      if (brake) acc -= s.v > 0 ? 420 : -420;
      s.v += acc * dt;
      if (s.v < -140) s.v = -140;
      // wheelie: throttle lifts the nose (more when climbing or launching slowly); springs pull it back
      const launch = Math.max(0, 120 - s.v) * 0.008;
      const torque = gas * (1.4 + Math.max(0, th) * 14.7 + launch) - brake * 2.4;
      s.spin += (torque - s.pitch * 5.6 - s.spin * 2.4) * dt;
      s.pitch += s.spin * dt;
      if (s.pitch > HR_FLIP_AT || s.pitch < -HR_FLIP_AT) {
        crash(s);
      } else {
        // ballistic look-ahead: if the ground drops away faster than gravity, we take off
        const vx = s.v * cs;
        const vy = -s.v * sn;
        const nx = Math.max(0, s.x + vx * dt);
        const ny = s.y + vy * dt + 0.5 * G * dt * dt;
        const gy = groundY(w, nx) - HR_CAR_H;
        if (ny < gy - 1.5 && s.v > 120) {
          s.air = 1;
          s.x = nx;
          s.y = ny;
          s.vx = vx;
          s.vy = vy + G * dt;
          s.av = s.spin;
          s.a = th + s.pitch;
        } else {
          s.x = nx;
          s.y = gy;
        }
      }
      if (!s.air) s.a = slopeAt(w, s.x) + s.pitch;
    } else {
      s.airTicks++;
      s.vy += G * dt;
      s.vx -= s.vx * 0.05 * dt;
      s.x = Math.max(0, s.x + s.vx * dt);
      s.y += s.vy * dt;
      s.av += ((gas - brake) * ROT - s.av * 1.2) * dt;
      s.a += s.av * dt;
      const gy = groundY(w, s.x) - HR_CAR_H;
      if (s.y >= gy) {
        const th = slopeAt(w, s.x);
        const rel = s.a - th;
        s.y = gy;
        s.air = 0;
        if (rel > HR_LAND_MAX || rel < -HR_LAND_MAX) {
          crash(s);
          s.a = th;
        } else {
          // keep the velocity along the ground, lose the impact
          s.v = s.vx * dcos(th) - s.vy * dsin(th);
          if (rel < 0.14 && rel > -0.14) {
            s.v += 60;
            s.perfect++;
          }
          s.pitch = rel > 0.5 ? 0.5 : rel < -0.5 ? -0.5 : rel;
          s.spin = 0;
          s.av = 0;
        }
      }
    }
    if (s.x >= HR_LEN) s.finished = tick + 1;
    s.x = Math.round(s.x * 100) / 100;
    s.y = Math.round(s.y * 100) / 100;
    s.v = Math.round(s.v * 100) / 100;
    s.vx = Math.round(s.vx * 100) / 100;
    s.vy = Math.round(s.vy * 100) / 100;
    s.a = r3(s.a);
    s.pitch = r3(s.pitch);
    s.spin = r3(s.spin);
    s.av = r3(s.av);
  },
  done(_w, s) {
    return s.finished > 0;
  },
};

/** Bot / assist logic shared by server bots and tests. */
export function hillBot(w: HRWorld, s: HRState, skill: number, rnd: () => number): [number, number, number] {
  if (s.air) {
    const landX = s.x + s.vx * 0.35;
    const err = s.a + s.av * 0.25 - slopeAt(w, landX);
    const tol = 0.08 + (1 - skill) * 0.25;
    if (err > tol) return [-8, 0, 0];
    if (err < -tol) return [8, 0, 0];
    return [0, 0, 0];
  }
  const thr = 0.5 + skill * 0.3 + (rnd() - 0.5) * (1 - skill) * 0.5;
  return s.pitch + s.spin * 0.3 < thr ? [8, 0, 0] : [0, 0, 0];
}
