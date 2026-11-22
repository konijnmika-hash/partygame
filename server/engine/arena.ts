// Lightweight 2D physics helpers for server-authoritative arena games.
import type { InputFrame } from '@shared/types';

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
}

export function makeBody(id: string, x: number, y: number, r = 26, m = 1): Body {
  return { id, x, y, vx: 0, vy: 0, r, m };
}

/** Accelerate a body toward the joystick direction, with drag and a speed cap. */
export function steer(b: Body, f: InputFrame | undefined, dt: number, accel: number, maxSpeed: number, drag = 4): void {
  const ix = f?.x ?? 0;
  const iy = f?.y ?? 0;
  const mag = Math.sqrt(ix * ix + iy * iy);
  const nx = mag > 1 ? ix / mag : ix;
  const ny = mag > 1 ? iy / mag : iy;
  b.vx += nx * accel * dt;
  b.vy += ny * accel * dt;
  const k = Math.max(0, 1 - drag * dt);
  b.vx *= k;
  b.vy *= k;
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp > maxSpeed) {
    // soft cap so dashes/knockbacks can exceed it briefly
    const over = sp - maxSpeed;
    const target = maxSpeed + over * Math.max(0, 1 - 3 * dt);
    b.vx = (b.vx / sp) * target;
    b.vy = (b.vy / sp) * target;
  }
}

export function integrate(b: Body, dt: number): void {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

/** Elastic-ish circle collisions. Calls onHit(a, b, impactSpeed) for each contact. */
export function collide(bodies: Body[], restitution = 0.9, onHit?: (a: Body, b: Body, impact: number) => void): void {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const rr = a.r + b.r;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = rr - d;
      const tm = a.m + b.m;
      a.x -= nx * overlap * (b.m / tm);
      a.y -= ny * overlap * (b.m / tm);
      b.x += nx * overlap * (a.m / tm);
      b.y += ny * overlap * (a.m / tm);
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn > 0) continue;
      const jImp = (-(1 + restitution) * vn) / (1 / a.m + 1 / b.m);
      a.vx -= (jImp / a.m) * nx;
      a.vy -= (jImp / a.m) * ny;
      b.vx += (jImp / b.m) * nx;
      b.vy += (jImp / b.m) * ny;
      onHit?.(a, b, -vn);
    }
  }
}

/** Keep a body inside a rectangle; bounce factor 0 = stop at walls. */
export function clampRect(b: Body, x0: number, y0: number, x1: number, y1: number, bounce = 0.5): boolean {
  let hit = false;
  if (b.x - b.r < x0) { b.x = x0 + b.r; b.vx = Math.abs(b.vx) * bounce; hit = true; }
  if (b.x + b.r > x1) { b.x = x1 - b.r; b.vx = -Math.abs(b.vx) * bounce; hit = true; }
  if (b.y - b.r < y0) { b.y = y0 + b.r; b.vy = Math.abs(b.vy) * bounce; hit = true; }
  if (b.y + b.r > y1) { b.y = y1 - b.r; b.vy = -Math.abs(b.vy) * bounce; hit = true; }
  return hit;
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dirTo(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / d, y: dy / d };
}

export function speedOf(b: Body): number {
  return Math.sqrt(b.vx * b.vx + b.vy * b.vy);
}

/** Dash impulse in the joystick direction (or current velocity if idle). */
export function dash(b: Body, f: InputFrame | undefined, power: number): void {
  let dx = f?.x ?? 0;
  let dy = f?.y ?? 0;
  if (Math.abs(dx) + Math.abs(dy) < 0.1) {
    dx = b.vx;
    dy = b.vy;
  }
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.01) return;
  b.vx += (dx / d) * power;
  b.vy += (dy / d) * power;
}

export const r1 = (v: number) => Math.round(v * 10) / 10;

/** Edge-triggered button helper: returns true on the frame A goes down. */
export class Buttons {
  private prev = new Map<string, number>();
  pressed(pid: string, f: InputFrame | undefined, bit = 1): boolean {
    const cur = f?.b ?? 0;
    const was = this.prev.get(pid + bit) ?? 0;
    this.prev.set(pid + bit, cur & bit);
    return (cur & bit) !== 0 && (was & bit) === 0;
  }
}

/** Steering bot helper: move toward a point, with a little wobble. */
export function seek(from: { x: number; y: number }, to: { x: number; y: number }, wobble = 0.2, rnd = Math.random): InputFrame {
  const d = dirTo(from, to);
  return { x: clampUnit(d.x + (rnd() - 0.5) * wobble), y: clampUnit(d.y + (rnd() - 0.5) * wobble), b: 0 };
}

export function flee(from: { x: number; y: number }, threat: { x: number; y: number }, wobble = 0.2, rnd = Math.random): InputFrame {
  const d = dirTo(threat, from);
  return { x: clampUnit(d.x + (rnd() - 0.5) * wobble), y: clampUnit(d.y + (rnd() - 0.5) * wobble), b: 0 };
}

function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
