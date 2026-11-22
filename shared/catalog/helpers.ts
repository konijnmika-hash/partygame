import type { CategoryId, Control, GameMeta } from '../types';

type Extra = Partial<Pick<GameMeta, 'teams' | 'realtime' | 'orientation' | 'needsSound' | 'mic' | 'original' | 'tags'>>;

export function cat(category: CategoryId, original = false) {
  return (
    id: string,
    name: string,
    emoji: string,
    tagline: string,
    instructions: string[],
    controls: Control[],
    minPlayers: number,
    maxPlayers: number,
    duration: number,
    extra: Extra = {},
  ): GameMeta => ({ id, name, category, emoji, tagline, instructions, controls, minPlayers, maxPlayers, duration, ...(original ? { original: true } : {}), ...extra });
}
