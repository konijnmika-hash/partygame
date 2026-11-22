// Chooses the next minigame for a round according to the room settings and player count.
import type { RoomSettings } from '@shared/types';
import { CATALOG, GAME_MAP, supportsCount } from '@shared/catalog/index';

export function compatibleGames(settings: RoomSettings, players: number, available: Set<string>): string[] {
  return CATALOG.filter((g) => available.has(g.id) && supportsCount(g, players))
    .filter((g) => {
      if (settings.mode === 'categories' && settings.categories.length) return settings.categories.includes(g.category);
      if (settings.mode === 'playlist' && settings.playlist.length) return settings.playlist.includes(g.id);
      return true;
    })
    .map((g) => g.id);
}

export function pickNextGame(
  settings: RoomSettings,
  players: number,
  used: string[],
  roundIndex: number,
  available: Set<string>,
  rnd: () => number = Math.random,
): string | null {
  if (settings.mode === 'playlist' && settings.playlist.length) {
    const list = settings.playlist.filter((id) => available.has(id));
    for (let i = 0; i < list.length; i++) {
      const id = list[(roundIndex + i) % list.length];
      const meta = GAME_MAP[id];
      if (meta && supportsCount(meta, players) && (settings.allowRepeats || !used.includes(id) || i === list.length - 1)) return id;
    }
  }
  let pool = compatibleGames(settings, players, available);
  if (!pool.length) pool = CATALOG.filter((g) => available.has(g.id) && supportsCount(g, players)).map((g) => g.id);
  if (!pool.length) return null;
  if (!settings.allowRepeats) {
    const fresh = pool.filter((id) => !used.includes(id));
    if (fresh.length) pool = fresh;
  }
  // avoid the same category twice in a row when possible (keeps variety high)
  const last = used.length ? GAME_MAP[used[used.length - 1]]?.category : null;
  if (last && settings.mode === 'random') {
    const varied = pool.filter((id) => GAME_MAP[id].category !== last);
    if (varied.length) pool = varied;
  }
  return pool[Math.floor(rnd() * pool.length)];
}
