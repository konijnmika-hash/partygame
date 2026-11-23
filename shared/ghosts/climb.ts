// Platform Race: bounce automatically on platforms, steer left/right (wrapping around the
// screen) and climb as high as you can. Springs launch you, fragile platforms break, moving
// ones slide. Falling far below your best costs time while a cloud carries you back up.
import type { GhostDef, GInput } from '../ghost';
import { createRng } from '../rng';
import { dsin } from '../dmath';
import type { Difficulty } from '../types';

export const CL_HZ = 30;
export const CL_W = 480;
export const CL_PW = 76;
const G = 1500;
const JUMP_V = 820;
const SPRING_V = 1500;
const SPEED = 400;
const FALL_LIMIT = 760;

export type CLKind = 0 | 1 | 2 | 3; // normal, spring, moving, fragile
export interface CLPlatform { x: number; y: number; k: CLKind; amp: number; ph: number }

export interface CLWorld {
  plats: CLPlatform[];
}

export interface CLState {
  x: number;
  y: number;
  vy: number;
  best: number;
  /** index of the last platform bounced on */
  last: number;
  /** fragile platforms broken by this player (indices) */
  broken: number[];
  /** ticks left being rescued */
  rescue: number;
  falls: number;
  springs: number;
  face: number;
}

/** x of platform i at tick (moving platforms oscillate). */
export function platX(p: CLPlatform, tick: number): number {
  if (p.k !== 2) return p.x;
  return p.x + p.amp * dsin(tick / CL_HZ * 1.6 + p.ph);
}

export const climbDef: GhostDef<CLWorld, CLState> = {
  id: 'platform-race',
  hz: CL_HZ,
  maxTicks: CL_HZ * 60,
  world(seed: number, d: Difficulty): CLWorld {
    const rng = createRng(seed);
    const plats: CLPlatform[] = [{ x: CL_W / 2, y: 0, k: 0, amp: 0, ph: 0 }];
    let y = 0;
    const hard = d === 'hard' ? 1.2 : d === 'easy' ? 0.8 : 1;
    while (y > -30_000) {
      const h = -y;
      const gap = Math.min(190, (70 + h / 300) * hard) * (0.75 + rng.next() * 0.5);
      y -= gap;
      const r = rng.next();
      const k: CLKind = h < 600 ? 0 : r < 0.06 ? 1 : r < 0.06 + Math.min(0.25, h / 40000) ? 2 : r < 0.12 + Math.min(0.3, h / 30000) ? 3 : 0;
      const x = CL_PW / 2 + rng.next() * (CL_W - CL_PW);
      plats.push({ x: Math.round(x), y: Math.round(y), k, amp: k === 2 ? Math.round(60 + rng.next() * 80) : 0, ph: Math.round(rng.next() * 600) / 100 });
      // a fragile platform is never the only way up: add a solid neighbour
      if (k === 3) {
        const x2 = (x + CL_W / 2) % CL_W;
        plats.push({ x: Math.round(Math.max(CL_PW / 2, Math.min(CL_W - CL_PW / 2, x2))), y: Math.round(y - 20), k: 0, amp: 0, ph: 0 });
        y -= 20;
      }
    }
    return { plats };
  },
  init(): CLState {
    return { x: CL_W / 2, y: -1, vy: -JUMP_V, best: 0, last: 0, broken: [], rescue: 0, falls: 0, springs: 0, face: 1 };
  },
  step(w, s, input, _prev, tick) {
    const dt = 1 / CL_HZ;
    if (s.rescue > 0) {
      s.rescue--;
      if (s.rescue === 0) s.vy = -JUMP_V;
      return;
    }
    const ix = input[0] / 8;
    if (ix > 0.1) s.face = 1;
    else if (ix < -0.1) s.face = -1;
    s.x += ix * SPEED * dt;
    if (s.x < 0) s.x += CL_W;
    if (s.x >= CL_W) s.x -= CL_W;
    const py = s.y;
    s.vy += G * dt;
    s.y += s.vy * dt;
    if (s.vy > 0) {
      // landing check: platforms whose top we crossed this tick (platforms are sorted top-down by index)
      const i0 = firstBelow(w.plats, py - 1);
      for (let i = i0; i >= 0 && i < w.plats.length; i--) {
        const p = w.plats[i];
        if (p.y < py - 1) continue;
        if (p.y > s.y) break;
        if (p.k === 3 && s.broken.includes(i)) continue;
        const px = platX(p, tick);
        let dx = s.x - px;
        if (dx > CL_W / 2) dx -= CL_W;
        if (dx < -CL_W / 2) dx += CL_W;
        if (dx < -CL_PW / 2 - 10 || dx > CL_PW / 2 + 10) continue;
        s.y = p.y;
        s.vy = p.k === 1 ? -SPRING_V : -JUMP_V;
        if (p.k === 1) s.springs++;
        if (p.k === 3) {
          s.broken.push(i);
          if (s.broken.length > 12) s.broken.shift();
        }
        s.last = i;
        break;
      }
    }
    if (-s.y > s.best) s.best = -s.y;
    // fell too far: a cloud rescues you to the highest platform below your best
    if (s.y > -s.best + FALL_LIMIT) {
      s.falls++;
      let j = 0;
      for (let i = 0; i < w.plats.length; i++) {
        if (w.plats[i].y < -s.best + 120) break;
        if (w.plats[i].k !== 3) j = i;
      }
      s.y = w.plats[j].y;
      s.x = platX(w.plats[j], tick);
      s.vy = 0;
      s.rescue = Math.round(CL_HZ * 1.2);
    }
    s.x = Math.round(s.x * 100) / 100;
    s.y = Math.round(s.y * 100) / 100;
    s.vy = Math.round(s.vy * 100) / 100;
    s.best = Math.round(s.best * 100) / 100;
  },
  done() {
    return false;
  },
};

/** Highest index whose platform is at or below y (platform y values decrease with index). */
function firstBelow(plats: CLPlatform[], y: number): number {
  let lo = 0;
  let hi = plats.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (plats[mid].y >= y) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Bot: aim for the highest platform it can still reach this bounce (or keep bouncing in place). */
export function climbBot(w: CLWorld, s: CLState, tick: number, skill: number, rnd: () => number): GInput {
  if (s.rescue > 0) return [0, 0, 0];
  const up = s.vy < 0 ? -s.vy / G : 0;
  const apexY = s.y - (s.vy < 0 ? (s.vy * s.vy) / (2 * G) : 0);
  const wrapDx = (x: number) => {
    let dx = x - s.x;
    if (dx > CL_W / 2) dx -= CL_W;
    if (dx < -CL_W / 2) dx += CL_W;
    return dx;
  };
  let target = s.last;
  let bestY = Infinity;
  const reachK = 0.6 + skill * 0.35;
  for (let i = s.last + 1; i < w.plats.length && i < s.last + 30; i++) {
    const p = w.plats[i];
    if (p.y < apexY + 3) break;
    if (p.k === 3 && s.broken.includes(i)) continue;
    if (s.vy > 0 && p.y < s.y) continue;
    const tAvail = up + Math.sqrt(Math.max(0, (2 * (p.y - apexY)) / G));
    const dx = wrapDx(platX(p, tick + Math.round(tAvail * CL_HZ)));
    if (Math.abs(dx) > SPEED * tAvail * reachK) continue;
    const y = p.y - (p.k === 1 ? 400 : 0) + (rnd() - 0.5) * (1 - skill) * 120;
    if (y < bestY) {
      bestY = y;
      target = i;
    }
  }
  const p = w.plats[target];
  if (!p) return [0, 0, 0];
  const dx = wrapDx(platX(p, tick + 6));
  if (Math.abs(dx) < 8) return [0, 0, 0];
  return [Math.max(-8, Math.min(8, Math.round(dx / 5))), 0, 0];
}
