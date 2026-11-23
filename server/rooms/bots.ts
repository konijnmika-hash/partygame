import { randomHex, randomInt } from '../util/rand';
import type { Avatar } from '@shared/types';

const NAMES = ['Beep Bloop', 'Robo Jelly', 'Sir Wobble', 'Captain Goo', 'Pixel Pal', 'Nugget-3000', 'Dr. Boing', 'Mecha Mochi', 'Tin Toast', 'Gizmo Gum', 'Clank', 'Bolt Bean', 'Sprocket', 'Widget', 'Byte Size', 'Turbo Tofu'];
const COLORS = ['c-mint', 'c-coral', 'c-ocean', 'c-lilac', 'c-sunny', 'c-lime', 'c-tangerine', 'c-sky'];
const EYES = ['e-robot', 'e-round', 'e-happy', 'e-star', 'e-sleepy'];
const MOUTHS = ['m-grin', 'm-smile', 'm-o', 'm-teeth', 'm-zigzag'];
const HATS = ['h-propeller', 'h-headphones', 'h-cap', 'h-party', 'h-sprout', 'h-none'];

export function makeBotProfile(taken: Set<string>): { id: string; name: string; avatar: Avatar } {
  const free = NAMES.filter((n) => !taken.has(n));
  const name = free.length ? free[Math.floor(Math.random() * free.length)] : `Bot ${randomInt(100, 999)}`;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return {
    id: `bot_${randomHex(6)}`,
    name,
    avatar: { color: pick(COLORS), eyes: pick(EYES), mouth: pick(MOUTHS), hat: pick(HATS), acc: 'a-none' },
  };
}
