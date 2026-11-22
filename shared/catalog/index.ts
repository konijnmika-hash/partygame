import type { CategoryId, GameMeta } from '../types';
import { DRAWING } from './drawing';
import { REACTION } from './reaction';
import { SOCIAL } from './social';
import { PHYSICS } from './physics';
import { RACING } from './racing';
import { MEMORY } from './memory';
import { PUZZLE } from './puzzle';
import { TEAM } from './team';
import { WEIRD } from './weird';
import { ARCADE } from './arcade';
import { SKILL } from './skill';
import { BRAIN } from './brain';
import { MIND } from './mind';

export const CATALOG: GameMeta[] = [
  ...DRAWING, ...REACTION, ...SOCIAL, ...PHYSICS, ...RACING, ...MEMORY, ...PUZZLE,
  ...TEAM, ...WEIRD, ...ARCADE, ...SKILL, ...BRAIN, ...MIND,
];

export const GAME_MAP: Record<string, GameMeta> = {};
for (const m of CATALOG) {
  if (GAME_MAP[m.id]) throw new Error(`Duplicate game id ${m.id}`);
  GAME_MAP[m.id] = m;
}

export function gamesInCategory(c: CategoryId): GameMeta[] {
  return CATALOG.filter((g) => g.category === c);
}

export function supportsCount(m: GameMeta, n: number): boolean {
  return n >= m.minPlayers && n <= m.maxPlayers;
}
