// Phone tilt controls (DeviceOrientation). Enabled on demand from a user gesture (iOS needs a
// permission prompt), calibrated to however the player is holding the phone at that moment.

export const tilt = { x: 0, y: 0, active: false };

let base: { beta: number; gamma: number } | null = null;
let listening = false;
const RANGE = 22; // degrees of tilt for full deflection

function screenAngle(): number {
  const a = (screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window as any).orientation) ?? 0;
  return ((Number(a) % 360) + 360) % 360;
}

function onOrient(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  if (!base) base = { beta: e.beta, gamma: e.gamma };
  const db = e.beta - base.beta;
  const dg = e.gamma - base.gamma;
  let x: number;
  let y: number;
  switch (screenAngle()) {
    case 90:
      x = db;
      y = -dg;
      break;
    case 270:
      x = -db;
      y = dg;
      break;
    case 180:
      x = -dg;
      y = -db;
      break;
    default:
      x = dg;
      y = db;
  }
  const clamp = (v: number) => Math.max(-1, Math.min(1, v / RANGE));
  tilt.x = Math.round(clamp(x) * 100) / 100;
  tilt.y = Math.round(clamp(y) * 100) / 100;
}

export function tiltSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/** Must be called from a click/tap handler. Resolves to whether tilt is now active. */
export async function enableTilt(): Promise<boolean> {
  if (!tiltSupported()) return false;
  const DOE = (window as any).DeviceOrientationEvent;
  if (typeof DOE.requestPermission === 'function') {
    try {
      const res = await DOE.requestPermission();
      if (res !== 'granted') return false;
    } catch {
      return false;
    }
  }
  base = null;
  if (!listening) {
    window.addEventListener('deviceorientation', onOrient);
    listening = true;
  }
  tilt.active = true;
  return true;
}

export function recalibrateTilt(): void {
  base = null;
}

export function disableTilt(): void {
  if (listening) window.removeEventListener('deviceorientation', onOrient);
  listening = false;
  tilt.active = false;
  tilt.x = 0;
  tilt.y = 0;
  base = null;
}
