// Speed Run: a tile-based platformer. Run, jump (hold for higher), dodge spikes and pits,
// respawn at checkpoints. The level is generated from chunks that are always clearable.
import type { GhostDef, GInput } from '../ghost';
import { createRng } from '../rng';
import type { Difficulty } from '../types';

export const PF_HZ = 30;
export const PF_T = 40;
export const PF_ROWS = 12;
export const PF_PW = 26;
export const PF_PH = 34;
const RUN = 300;
const ACC_G = 2600;
const ACC_A = 1600;
const G = 2200;
const JUMP_V = 760;
const CUT_V = 260;
const MAX_FALL = 900;
const DEAD_TICKS = 24;

/** tile codes: 0 air, 1 solid, 2 spikes, 3 checkpoint flag, 4 goal */
export interface PFWorld {
  cols: number;
  tiles: number[];
  checkpoints: number[];
  goalX: number;
  startX: number;
  startY: number;
}

export interface PFState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: number;
  coyote: number;
  buf: number;
  cp: number;
  dead: number;
  deaths: number;
  finished: number;
  face: number;
}

export function tileAt(w: PFWorld, c: number, r: number): number {
  if (c < 0 || c >= w.cols) return 1;
  if (r < 0) return 0;
  if (r >= PF_ROWS) return 0;
  return w.tiles[r * w.cols + c];
}

function solidAt(w: PFWorld, c: number, r: number): boolean {
  return tileAt(w, c, r) === 1;
}

export const platformerDef: GhostDef<PFWorld, PFState> = {
  id: 'speed-run',
  hz: PF_HZ,
  maxTicks: PF_HZ * 90,
  world(seed: number, d: Difficulty): PFWorld {
    const rng = createRng(seed);
    const heights: number[] = [];
    const extras: { c: number; r: number; t: number }[] = [];
    const L = d === 'easy' ? 150 : d === 'hard' ? 210 : 180;
    let h = 3;
    const flat = (n: number) => {
      for (let i = 0; i < n; i++) heights.push(h);
    };
    flat(8);
    let sinceCp = 0;
    const checkpoints: number[] = [];
    while (heights.length < L - 14) {
      const r = rng.next();
      const c0 = heights.length;
      if (r < 0.18) {
        // pit
        const wdt = rng.int(2, d === 'easy' ? 2 : 3);
        for (let i = 0; i < wdt; i++) heights.push(0);
        flat(3);
      } else if (r < 0.34) {
        // step up or down
        const dh = rng.chance(0.55) ? rng.int(1, 2) : -rng.int(1, 2);
        h = Math.max(2, Math.min(6, h + dh));
        flat(3);
      } else if (r < 0.5) {
        // spikes on the ground
        flat(2);
        const n = rng.int(1, d === 'hard' ? 3 : 2);
        for (let i = 0; i < n; i++) {
          extras.push({ c: heights.length, r: PF_ROWS - h - 1, t: 2 });
          heights.push(h);
        }
        flat(3);
      } else if (r < 0.63) {
        // wall block
        flat(2);
        const tall = rng.int(1, 2);
        for (let k = 1; k <= tall; k++) extras.push({ c: heights.length, r: PF_ROWS - h - k, t: 1 });
        heights.push(h);
        flat(3);
      } else if (r < 0.8) {
        // floating platforms over a pit
        const lift = rng.int(0, 2);
        for (let i = 0; i < 3; i++) heights.push(0);
        for (let i = 0; i < 2; i++) {
          extras.push({ c: heights.length, r: PF_ROWS - h - lift, t: 1 });
          heights.push(0);
        }
        for (let i = 0; i < 2; i++) heights.push(0);
        flat(3);
      } else if (r < 0.9) {
        // spike pit with a stepping stone
        flat(1);
        for (let i = 0; i < 2; i++) {
          extras.push({ c: heights.length, r: PF_ROWS - h - 1, t: 2 });
          heights.push(h);
        }
        extras.push({ c: heights.length, r: PF_ROWS - h - 1, t: 1 });
        heights.push(h);
        for (let i = 0; i < 2; i++) {
          extras.push({ c: heights.length, r: PF_ROWS - h - 1, t: 2 });
          heights.push(h);
        }
        flat(3);
      } else flat(rng.int(3, 6));
      sinceCp += heights.length - c0;
      if (sinceCp > 34) {
        checkpoints.push(heights.length);
        flat(3);
        sinceCp = 0;
      }
    }
    flat(14);
    const cols = heights.length;
    const tiles = new Array(cols * PF_ROWS).fill(0);
    heights.forEach((hh, c) => {
      for (let k = 0; k < hh; k++) tiles[(PF_ROWS - 1 - k) * cols + c] = 1;
    });
    for (const e of extras) if (e.r >= 0 && e.r < PF_ROWS) tiles[e.r * cols + e.c] = e.t;
    for (const c of checkpoints) tiles[(PF_ROWS - heights[c] - 1) * cols + c] = 3;
    const goalC = cols - 6;
    tiles[(PF_ROWS - heights[goalC] - 1) * cols + goalC] = 4;
    return { cols, tiles, checkpoints: checkpoints.map((c) => c * PF_T + PF_T / 2), goalX: goalC * PF_T, startX: 3 * PF_T, startY: (PF_ROWS - 3) * PF_T };
  },
  init(w): PFState {
    return { x: w.startX, y: w.startY, vx: 0, vy: 0, ground: 1, coyote: 0, buf: 0, cp: -1, dead: 0, deaths: 0, finished: 0, face: 1 };
  },
  step(w, s, input, prev, tick) {
    if (s.finished) return;
    const dt = 1 / PF_HZ;
    if (s.dead > 0) {
      s.dead--;
      if (s.dead === 0) respawn(w, s);
      return;
    }
    const ix = input[0] / 8;
    const jumpHeld = (input[2] & 1) !== 0 || input[1] < -3;
    const jumpPressed = jumpHeld && !((prev[2] & 1) !== 0 || prev[1] < -3);
    if (ix > 0.1) s.face = 1;
    else if (ix < -0.1) s.face = -1;
    // horizontal
    const target = ix * RUN;
    const acc = (s.ground ? ACC_G : ACC_A) * dt;
    s.vx += Math.max(-acc, Math.min(acc, target - s.vx));
    // jumping with coyote time + buffer
    if (jumpPressed) s.buf = 5;
    else if (s.buf > 0) s.buf--;
    if (s.buf > 0 && (s.ground || s.coyote > 0)) {
      s.vy = -JUMP_V;
      s.buf = 0;
      s.coyote = 0;
      s.ground = 0;
    }
    if (!jumpHeld && s.vy < -CUT_V) s.vy = -CUT_V;
    s.vy = Math.min(MAX_FALL, s.vy + G * dt);
    // move X then resolve
    s.x += s.vx * dt;
    const top = s.y - PF_PH;
    const r0 = Math.floor((top + 1) / PF_T);
    const r1 = Math.floor((s.y - 1) / PF_T);
    if (s.vx > 0) {
      const c = Math.floor((s.x + PF_PW / 2) / PF_T);
      for (let r = r0; r <= r1; r++) if (solidAt(w, c, r)) {
        s.x = c * PF_T - PF_PW / 2 - 0.01;
        s.vx = 0;
        break;
      }
    } else if (s.vx < 0) {
      const c = Math.floor((s.x - PF_PW / 2) / PF_T);
      for (let r = r0; r <= r1; r++) if (solidAt(w, c, r)) {
        s.x = (c + 1) * PF_T + PF_PW / 2 + 0.01;
        s.vx = 0;
        break;
      }
    }
    // move Y then resolve
    const wasGround = s.ground;
    s.y += s.vy * dt;
    s.ground = 0;
    const c0 = Math.floor((s.x - PF_PW / 2 + 1) / PF_T);
    const c1 = Math.floor((s.x + PF_PW / 2 - 1) / PF_T);
    if (s.vy >= 0) {
      const r = Math.floor(s.y / PF_T);
      for (let c = c0; c <= c1; c++) if (solidAt(w, c, r)) {
        s.y = r * PF_T;
        s.vy = 0;
        s.ground = 1;
        break;
      }
    } else {
      const r = Math.floor((s.y - PF_PH) / PF_T);
      for (let c = c0; c <= c1; c++) if (solidAt(w, c, r)) {
        s.y = (r + 1) * PF_T + PF_PH;
        s.vy = 0;
        break;
      }
    }
    if (wasGround && !s.ground && s.vy >= 0) s.coyote = 4;
    else if (s.coyote > 0) s.coyote--;
    // hazards, checkpoints, goal
    const hr0 = Math.floor((s.y - PF_PH + 8) / PF_T);
    const hr1 = Math.floor((s.y - 4) / PF_T);
    const hc0 = Math.floor((s.x - PF_PW / 2 + 5) / PF_T);
    const hc1 = Math.floor((s.x + PF_PW / 2 - 5) / PF_T);
    for (let r = hr0; r <= hr1; r++) for (let c = hc0; c <= hc1; c++) if (tileAt(w, c, r) === 2) s.dead = DEAD_TICKS;
    if (s.y > PF_ROWS * PF_T + 80) s.dead = DEAD_TICKS;
    if (s.dead) {
      s.deaths++;
      s.vx = 0;
      s.vy = 0;
    }
    for (let i = s.cp + 1; i < w.checkpoints.length; i++) if (s.x >= w.checkpoints[i]) s.cp = i;
    if (s.x >= w.goalX) s.finished = tick + 1;
    s.x = Math.round(s.x * 100) / 100;
    s.y = Math.round(s.y * 100) / 100;
    s.vx = Math.round(s.vx * 100) / 100;
    s.vy = Math.round(s.vy * 100) / 100;
  },
  done(_w, s) {
    return s.finished > 0;
  },
};

function respawn(w: PFWorld, s: PFState) {
  const x = s.cp >= 0 ? w.checkpoints[s.cp] : w.startX;
  const c = Math.floor(x / PF_T);
  let r = 0;
  while (r < PF_ROWS && !solidAt(w, c, r)) r++;
  s.x = x;
  s.y = r * PF_T;
  s.vx = 0;
  s.vy = 0;
  s.ground = 1;
}

const BOT_OPTIONS: GInput[] = [
  [8, -8, 1], [8, 0, 0], [5, -8, 1], [5, 0, 0], [3, -8, 1], [0, 0, 0], [-4, 0, 0], [-8, -8, 1],
];

/**
 * Bot: a tiny look-ahead planner. Each option is committed for a few ticks (kept through the
 * whole flight if it jumped), then the bot brakes; options that would die are discarded and the
 * one that ends furthest right wins.
 */
export function platformerBot(w: PFWorld, s: PFState, tick: number, skill: number, rnd: () => number, prev: GInput = [0, 0, 0]): GInput {
  if (s.dead || s.finished) return [0, 0, 0];
  let best: GInput = [0, 0, 0];
  let bestScore = -Infinity;
  const STOP: GInput = [0, 0, 0];
  for (const opt of BOT_OPTIONS) {
    const sim: PFState = { ...s };
    let p = prev;
    let dead = false;
    for (let k = 0; k < 42; k++) {
      const inp = k < 5 || (opt[2] && !sim.ground) ? opt : STOP;
      platformerDef.step(w, sim, inp, p, tick + k);
      p = inp;
      if (sim.dead) {
        dead = true;
        break;
      }
      if (sim.finished) break;
    }
    const score = (dead ? -100_000 : 0) + sim.x + (sim.finished ? 10_000 : 0) + (rnd() - 0.5) * (1 - skill) * 120;
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  return best;
}
