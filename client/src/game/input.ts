// Unified controls: keyboard (WASD/arrows + space/shift), gamepads and the on-screen joystick
// all write into one input state. Realtime games read it every frame.
import { useEffect, useRef } from 'react';
import type { InputFrame } from '@shared/types';

const keys = new Set<string>();
export const virtual = { x: 0, y: 0, a: false, b: false, active: false };
let listening = 0;

function onKeyDown(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys.add(k);
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase());
}
function onBlur() {
  keys.clear();
}

export function startKeyboard(): () => void {
  if (listening++ === 0) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }
  return () => {
    if (--listening === 0) {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      keys.clear();
    }
  };
}

const DEAD = 0.18;

function gamepad(): { x: number; y: number; a: boolean; b: boolean } | null {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    let x = p.axes[0] ?? 0;
    let y = p.axes[1] ?? 0;
    if (Math.abs(x) < DEAD) x = 0;
    if (Math.abs(y) < DEAD) y = 0;
    const btn = (i: number) => !!p.buttons[i]?.pressed;
    if (btn(14)) x = -1;
    if (btn(15)) x = 1;
    if (btn(12)) y = -1;
    if (btn(13)) y = 1;
    return { x, y, a: btn(0) || btn(7), b: btn(1) || btn(2) || btn(6) };
  }
  return null;
}

/** Current combined input frame. */
export function readInput(): InputFrame {
  let x = 0;
  let y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  let a = keys.has(' ') || keys.has('enter') || keys.has('j') || keys.has('z');
  let b = keys.has('shift') || keys.has('k') || keys.has('x') || keys.has('e');
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  if (virtual.active || virtual.a || virtual.b) {
    if (virtual.active) {
      x = virtual.x;
      y = virtual.y;
    }
    a = a || virtual.a;
    b = b || virtual.b;
  }
  const g = gamepad();
  if (g) {
    if (g.x || g.y) {
      x = g.x;
      y = g.y;
    }
    a = a || g.a;
    b = b || g.b;
  }
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, b: (a ? 1 : 0) | (b ? 2 : 0) };
}

export function isKey(k: string): boolean {
  return keys.has(k);
}

/**
 * Streams input to the server for arena games: sends on change (max ~25/s) plus a keepalive.
 * Returns a ref with the latest frame for local rendering/prediction.
 */
export function useInputStream(send: (f: InputFrame) => void, enabled = true) {
  const latest = useRef<InputFrame>({ x: 0, y: 0, b: 0 });
  useEffect(() => {
    if (!enabled) return;
    const stop = startKeyboard();
    let last = '';
    let lastSent = 0;
    let raf = 0;
    const loop = () => {
      const f = readInput();
      latest.current = f;
      const key = `${f.x},${f.y},${f.b}`;
      const now = performance.now();
      if ((key !== last && now - lastSent > 38) || (now - lastSent > 250 && key !== '0,0,0') || (key !== last && key === '0,0,0')) {
        send(f);
        last = key;
        lastSent = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      stop();
      send({ x: 0, y: 0, b: 0 });
    };
  }, [enabled]);
  return latest;
}

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
}

/** Simple one-shot key handler hook (for turn-based games: arrows, numbers, enter). */
export function useKeys(handler: (key: string, e: KeyboardEvent) => void, enabled = true) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      h.current(e.key, e);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [enabled]);
}
