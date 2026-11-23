// Small shared helpers for the arcade views.
import type { RoomMember } from '@shared/types';
import { bodyColor } from '../../components/avatarSvg';
import { virtual } from '../../game/input';
import { vibrate } from '../../audio/sfx';

const FALLBACK = ['#ff4f5f', '#3da9fc', '#34cf78', '#ffb21f', '#a46bff', '#ff7ac8', '#2ad4c4', '#ff8a3d'];

/** A player's signature colour (their Bloop's body colour). */
export function colorOf(players: RoomMember[], id: string, i = 0): string {
  const p = players.find((x) => x.id === id);
  return p ? bodyColor(p.avatar) : FALLBACK[i % FALLBACK.length];
}

/** Briefly push the virtual stick in a direction (a swipe becomes one fresh "hop" input). */
export function pulseDir(x: number, y: number, ms = 110) {
  virtual.active = true;
  virtual.x = x;
  virtual.y = y;
  vibrate(8);
  setTimeout(() => {
    virtual.active = false;
    virtual.x = 0;
    virtual.y = 0;
  }, ms);
}

/** Briefly press the A button. */
export function pulseA(ms = 110) {
  virtual.a = true;
  vibrate(8);
  setTimeout(() => (virtual.a = false), ms);
}

/** Pointer handlers that tell a tap from a swipe (decided on release). */
export function tapOrSwipe(onTap: () => void, onSwipe: (dx: number, dy: number) => void, min = 22) {
  let start: { x: number; y: number } | null = null;
  return {
    onPointerDown: (e: { clientX: number; clientY: number }) => {
      start = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: { clientX: number; clientY: number }) => {
      const s = start;
      start = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) onTap();
      else if (Math.abs(dx) > Math.abs(dy)) onSwipe(Math.sign(dx), 0);
      else onSwipe(0, Math.sign(dy));
    },
  };
}
