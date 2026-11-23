// Arcade ghost sims: Hover Hop (flap through gaps), Gravity Flip (flip floor/ceiling to dodge
// spikes) and Road Hopper (hop across roads and rivers). Same deterministic rules on server and
// client; every run uses the same generated course.
import type { GhostDef, GInput } from '../ghost';
import { createRng } from '../rng';
import type { Difficulty } from '../types';

const r2 = (v: number) => Math.round(v * 100) / 100;

function circleRect(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const qx = cx < x0 ? x0 : cx > x1 ? x1 : cx;
  const qy = cy < y0 ? y0 : cy > y1 ? y1 : cy;
  const dx = cx - qx;
  const dy = cy - qy;
  return dx * dx + dy * dy < r * r;
}
const pressed = (i: GInput, p: GInput, bit = 1) => (i[2] & bit) !== 0 && (p[2] & bit) === 0;

/* ------------------------------------------------------------------ Hover Hop */

export const HH = { HZ: 30, H: 600, R: 17, PW: 70, X: 220 } as const;

export interface HHWorld { pillars: { x: number; gy: number; gap: number }[]; speed: number }
export interface HHState { x: number; y: number; vy: number; passed: number; out: number; flaps: number }

export const hoverDef: GhostDef<HHWorld, HHState> = {
  id: 'hover-hop',
  hz: HH.HZ,
  maxTicks: HH.HZ * 60,
  world(seed: number, d: Difficulty): HHWorld {
    const rng = createRng(seed);
    const pillars: HHWorld['pillars'] = [];
    let gy = 300;
    const gap0 = d === 'easy' ? 205 : d === 'hard' ? 172 : 185;
    const swing = d === 'easy' ? 220 : d === 'hard' ? 280 : 250;
    for (let k = 0; k < 160; k++) {
      // gap centres wander but never jump further than a flap sequence can follow
      gy = Math.max(150, Math.min(HH.H - 150, gy + (rng.next() - 0.5) * swing));
      pillars.push({ x: 700 + k * 290, gy: Math.round(gy), gap: Math.round(Math.max(gap0 - 25, gap0 - k * 0.6)) });
    }
    return { pillars, speed: d === 'easy' ? 200 : d === 'hard' ? 240 : 222 };
  },
  init(): HHState {
    return { x: 0, y: HH.H / 2, vy: 0, passed: 0, out: 0, flaps: 0 };
  },
  step(w, s, input, prev, tick) {
    if (s.out) return;
    const dt = 1 / HH.HZ;
    if (pressed(input, prev) || (input[1] < -3 && prev[1] >= -3)) {
      s.vy = -440;
      s.flaps++;
    }
    s.vy = Math.min(700, s.vy + 1500 * dt);
    s.y += s.vy * dt;
    s.x += (w.speed + Math.min(80, tick / 30)) * dt;
    if (s.y < HH.R) {
      s.y = HH.R;
      s.vy = 0;
    }
    if (s.y > HH.H - HH.R) s.out = tick + 1;
    const px = s.x + HH.X;
    for (let k = s.passed; k < w.pillars.length; k++) {
      const p = w.pillars[k];
      if (p.x - HH.PW / 2 - HH.R > px) break;
      if (p.x + HH.PW / 2 + HH.R < px) {
        s.passed = k + 1;
        continue;
      }
      // the pillar is two solid blocks above and below the gap
      if (circleRect(px, s.y, HH.R, p.x - HH.PW / 2, 0, p.x + HH.PW / 2, p.gy - p.gap / 2) || circleRect(px, s.y, HH.R, p.x - HH.PW / 2, p.gy + p.gap / 2, p.x + HH.PW / 2, HH.H)) s.out = tick + 1;
    }
    s.y = r2(s.y);
    s.vy = r2(s.vy);
    s.x = r2(s.x);
  },
  done(_w, s) {
    return s.out > 0;
  },
};

export function hoverBot(w: HHWorld, s: HHState, _tick: number, skill: number, rnd: () => number, prev: GInput = [0, 0, 0]): GInput {
  // a flap needs a fresh press: release first if the button is still held
  if (prev[2] & 1) return [0, 0, 0];
  const px = s.x + HH.X;
  const p = w.pillars.find((q) => q.x + HH.PW / 2 + HH.R >= px) ?? w.pillars[w.pillars.length - 1];
  const top = p.gy - p.gap / 2 + HH.R;
  const bottom = p.gy + p.gap / 2 - HH.R;
  const rise = (440 * 440) / 3000; // height one flap gains
  const slop = (rnd() - 0.5) * (1 - skill) * 50;
  const yFut = s.y + s.vy * 0.1;
  // flap when we're about to sink toward the bottom of the gap, unless that would overshoot the top
  const wantUp = yFut > bottom - 30 - (bottom - top) * 0.25 + slop;
  const safe = s.y - rise > top + 4 || px < p.x - HH.PW / 2 - 120;
  return wantUp && safe && s.vy > -150 ? [0, 0, 1] : [0, 0, 0];
}

/* ------------------------------------------------------------------ Gravity Flip */

export const GF = { HZ: 30, FLOOR: 470, CEIL: 130, R: 22, X: 230 } as const;

export interface GFWorld { spikes: { x: number; w: number; top: number }[]; v0: number; acc: number; vmax: number }
export interface GFState { x: number; y: number; vy: number; g: number; grounded: number; out: number; flips: number }

export const gflipDef: GhostDef<GFWorld, GFState> = {
  id: 'gravity-flip',
  hz: GF.HZ,
  maxTicks: GF.HZ * 60,
  world(seed: number, d: Difficulty): GFWorld {
    const rng = createRng(seed);
    const v0 = d === 'easy' ? 280 : d === 'hard' ? 340 : 310;
    const acc = d === 'easy' ? 3 : d === 'hard' ? 5 : 4;
    const vmax = d === 'easy' ? 470 : d === 'hard' ? 580 : 520;
    const spikes: GFWorld['spikes'] = [];
    let x = 900;
    let t = 0;
    while (t < 70) {
      const v = Math.min(vmax, v0 + acc * t);
      const top = rng.chance(0.5) ? 1 : 0;
      const w = Math.round(60 + rng.next() * 120);
      spikes.push({ x: Math.round(x), w, top });
      // leave time to flip (≈0.55 s) plus reaction
      const gap = v * (0.95 + rng.next() * 0.7) + w;
      x += gap;
      t += gap / v;
    }
    return { spikes, v0, acc, vmax };
  },
  init(): GFState {
    return { x: 0, y: GF.FLOOR - GF.R, vy: 0, g: 1, grounded: 1, out: 0, flips: 0 };
  },
  step(w, s, input, prev, tick) {
    if (s.out) return;
    const dt = 1 / GF.HZ;
    if ((pressed(input, prev) || (input[1] !== 0 && prev[1] === 0)) && s.grounded) {
      s.g = -s.g;
      s.grounded = 0;
      s.flips++;
    }
    s.vy += s.g * 2600 * dt;
    s.y += s.vy * dt;
    if (s.y >= GF.FLOOR - GF.R) {
      s.y = GF.FLOOR - GF.R;
      s.vy = 0;
      s.grounded = s.g > 0 ? 1 : 0;
    } else if (s.y <= GF.CEIL + GF.R) {
      s.y = GF.CEIL + GF.R;
      s.vy = 0;
      s.grounded = s.g < 0 ? 1 : 0;
    } else s.grounded = 0;
    s.x += Math.min(w.vmax, w.v0 + (w.acc * tick) / GF.HZ) * dt;
    const px = s.x + GF.X;
    for (const sp of w.spikes) {
      if (sp.x > px + GF.R) break;
      if (sp.x + sp.w < px - GF.R) continue;
      // spikes are 34 px tall on their surface
      const hitFloor = !sp.top && s.y + GF.R > GF.FLOOR - 34;
      const hitCeil = sp.top && s.y - GF.R < GF.CEIL + 34;
      if (hitFloor || hitCeil) s.out = tick + 1;
    }
    s.x = r2(s.x);
    s.y = r2(s.y);
    s.vy = r2(s.vy);
  },
  done(_w, s) {
    return s.out > 0;
  },
};

export function gflipBot(w: GFWorld, s: GFState, tick: number, skill: number, rnd: () => number): GInput {
  if (!s.grounded) return [0, 0, 0];
  const v = Math.min(w.vmax, w.v0 + (w.acc * tick) / GF.HZ);
  const px = s.x + GF.X;
  const onTop = s.g < 0 ? 1 : 0;
  const next = w.spikes.find((sp) => sp.x + sp.w >= px - GF.R && sp.top === onTop);
  if (!next) return [0, 0, 0];
  const tta = (next.x - (px + GF.R)) / v;
  const lead = 0.32 + (rnd() - 0.5) * (1 - skill) * 0.4;
  return tta < lead && tta > -0.05 ? [0, 0, 1] : [0, 0, 0];
}

/* ------------------------------------------------------------------ Road Hopper */

export const RH = { HZ: 30, COLS: 11, LOOP: 17, CELL: 60 } as const;

export interface RHLane { kind: 'grass' | 'road' | 'river'; dir: number; speed: number; objs: { x: number; len: number }[] }
export interface RHWorld { lanes: RHLane[] }
export interface RHState { col: number; row: number; best: number; crossings: number; deaths: number; dead: number; cd: number; at: number }

/** Left edge (in cells, may be outside the board) of an object at a tick. */
export function laneObjX(l: RHLane, o: { x: number; len: number }, tick: number): number {
  const p = o.x + (l.dir * l.speed * tick) / RH.HZ;
  return ((p % RH.LOOP) + RH.LOOP) % RH.LOOP - 3;
}

export const hopperDef: GhostDef<RHWorld, RHState> = {
  id: 'road-hopper',
  hz: RH.HZ,
  maxTicks: RH.HZ * 70,
  world(seed: number, d: Difficulty): RHWorld {
    const rng = createRng(seed);
    const k = d === 'easy' ? 0.8 : d === 'hard' ? 1.25 : 1;
    const lanes: RHLane[] = [{ kind: 'grass', dir: 1, speed: 0, objs: [] }];
    const road = rng.int(3, 4);
    const river = rng.int(3, 4);
    const fill = (kind: 'road' | 'river') => {
      const dir = lanes.length % 2 ? 1 : -1;
      const speed = Math.round((kind === 'road' ? 1.6 + rng.next() * 1.6 : 1.1 + rng.next() * 1.1) * k * 100) / 100;
      const objs: { x: number; len: number }[] = [];
      let x = rng.next() * 3;
      while (x < RH.LOOP - 1) {
        const len = kind === 'road' ? rng.int(1, 2) : rng.int(2, 4);
        objs.push({ x: Math.round(x * 100) / 100, len });
        x += len + (kind === 'road' ? 2.2 + rng.next() * 3 : 1.2 + rng.next() * 1.6);
      }
      lanes.push({ kind, dir, speed, objs });
    };
    for (let i = 0; i < road; i++) fill('road');
    lanes.push({ kind: 'grass', dir: 1, speed: 0, objs: [] });
    for (let i = 0; i < river; i++) fill('river');
    lanes.push({ kind: 'grass', dir: 1, speed: 0, objs: [] });
    return { lanes };
  },
  init(): RHState {
    return { col: 5, row: 0, best: 0, crossings: 0, deaths: 0, dead: 0, cd: 0, at: 0 };
  },
  step(w, s, input, prev, tick) {
    const dt = 1 / RH.HZ;
    if (s.dead > 0) {
      s.dead--;
      if (s.dead === 0) {
        s.row = 0;
        s.col = 5;
      }
      return;
    }
    if (s.cd > 0) s.cd--;
    // a hop is a fresh push of the stick / key (or A = hop forward)
    let hop: [number, number] | null = null;
    const nowDir = Math.abs(input[0]) >= 4 || Math.abs(input[1]) >= 4;
    const prevDir = Math.abs(prev[0]) >= 4 || Math.abs(prev[1]) >= 4;
    if (nowDir && (!prevDir || Math.sign(input[0]) !== Math.sign(prev[0]) || Math.sign(input[1]) !== Math.sign(prev[1]))) {
      hop = Math.abs(input[0]) > Math.abs(input[1]) ? [Math.sign(input[0]), 0] : [0, -Math.sign(input[1])];
    } else if (pressed(input, prev)) hop = [0, 1];
    if (hop && s.cd === 0) {
      s.col = Math.max(0, Math.min(RH.COLS - 1, Math.round(s.col) + hop[0]));
      s.row = Math.max(0, Math.min(w.lanes.length - 1, s.row + hop[1]));
      s.cd = 3;
      s.at = tick;
      if (s.row > s.best) s.best = s.row;
    }
    const lane = w.lanes[s.row];
    if (lane.kind === 'road') {
      for (const o of lane.objs) {
        const x = laneObjX(lane, o, tick);
        if (s.col + 0.8 > x && s.col + 0.2 < x + o.len) return die(s);
      }
    } else if (lane.kind === 'river') {
      let on = false;
      for (const o of lane.objs) {
        const x = laneObjX(lane, o, tick);
        if (s.col + 0.5 > x && s.col + 0.5 < x + o.len) on = true;
      }
      if (!on) return die(s);
      s.col += lane.dir * lane.speed * dt;
      if (s.col < -0.4 || s.col > RH.COLS - 0.6) return die(s);
      s.col = r2(s.col);
    }
    if (s.row === w.lanes.length - 1) {
      s.crossings++;
      s.row = 0;
      s.col = 5;
      s.best = 0;
      s.cd = 8;
    }
  },
  done() {
    return false;
  },
};

function die(s: RHState) {
  s.deaths++;
  s.dead = 18;
}

/** Bot: look-ahead planner over the real step function (stay / up / left / right / down). */
export function hopperBot(w: RHWorld, s: RHState, tick: number, skill: number, rnd: () => number, prev: GInput = [0, 0, 0]): GInput {
  if (s.dead || s.cd) return [0, 0, 0];
  const OPTS: GInput[] = [[0, -8, 0], [0, 0, 0], [-8, 0, 0], [8, 0, 0], [0, 8, 0]];
  let best: GInput = [0, 0, 0];
  let bs = -Infinity;
  for (const opt of OPTS) {
    const sim: RHState = { ...s };
    let p = prev;
    let dead = false;
    for (let k = 0; k < 14; k++) {
      const inp = k < 2 ? opt : ([0, 0, 0] as GInput);
      hopperDef.step(w, sim, inp, p, tick + k);
      p = inp;
      if (sim.dead) {
        dead = true;
        break;
      }
    }
    const sc = (dead ? -1000 : 0) + (sim.crossings - s.crossings) * 100 + sim.row * 10 - Math.abs(sim.col - 5) * 0.5 + (rnd() - 0.5) * (1 - skill) * 30;
    if (sc > bs) {
      bs = sc;
      best = opt;
    }
  }
  return best;
}
