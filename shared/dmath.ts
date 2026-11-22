// Deterministic math helpers. Ghost simulations run identically on server and clients, so they
// avoid engine-specific transcendental functions (Math.sin/cos/atan2 may differ across engines).

const TWO_PI = 6.283185307179586;
const PI = 3.141592653589793;

/** Deterministic sine using range reduction + odd polynomial (max error ~1e-6). */
export function dsin(x: number): number {
  // reduce to [-PI, PI]
  x = x - TWO_PI * Math.floor((x + PI) / TWO_PI);
  // reduce to [-PI/2, PI/2]
  if (x > PI / 2) x = PI - x;
  else if (x < -PI / 2) x = -PI - x;
  const x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110)))));
}

export function dcos(x: number): number {
  return dsin(x + PI / 2);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
