import { z } from 'zod';
import type { CategoryId, RoomSettings } from '@shared/types';
import { CATEGORIES } from '@shared/categories';
import { GAME_MAP } from '@shared/catalog/index';

export const MAX_ROOM_PLAYERS = 16;

export function defaultSettings(isPublic: boolean): RoomSettings {
  return {
    rounds: isPublic ? 5 : 6,
    mode: 'random',
    categories: [],
    playlist: [],
    difficulty: 'normal',
    teamMode: 'off',
    allowRepeats: false,
    maxPlayers: isPublic ? 12 : 12,
    rules: { doubleFinal: false, speedMode: false, hideScores: false, underdog: false },
  };
}

const catIds = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

const patchSchema = z
  .object({
    rounds: z.number().int().min(1).max(20),
    mode: z.enum(['random', 'categories', 'playlist']),
    categories: z.array(z.enum(catIds)).max(catIds.length),
    playlist: z.array(z.string().max(40)).max(40),
    difficulty: z.enum(['easy', 'normal', 'hard']),
    teamMode: z.enum(['off', 'teams2', 'teams3']),
    allowRepeats: z.boolean(),
    maxPlayers: z.number().int().min(2).max(MAX_ROOM_PLAYERS),
    rules: z
      .object({
        doubleFinal: z.boolean(),
        speedMode: z.boolean(),
        hideScores: z.boolean(),
        underdog: z.boolean(),
      })
      .partial(),
  })
  .partial()
  .strict();

/** Validates a settings patch and merges it. Returns null on invalid input. */
export function applySettingsPatch(cur: RoomSettings, patch: unknown, available: Set<string>): RoomSettings | null {
  const r = patchSchema.safeParse(patch);
  if (!r.success) return null;
  const p = r.data;
  const next: RoomSettings = {
    ...cur,
    ...p,
    rules: { ...cur.rules, ...(p.rules || {}) },
    categories: p.categories ? Array.from(new Set(p.categories)) : cur.categories,
    playlist: p.playlist ? p.playlist.filter((id) => GAME_MAP[id] && available.has(id)) : cur.playlist,
  };
  return next;
}
