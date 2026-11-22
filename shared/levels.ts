// XP + level curve shared by server (authoritative) and client (display).

export const MAX_LEVEL = 100;

/** XP needed to advance from `level` to `level + 1`. */
export function xpForNext(level: number): number {
  return 100 + 50 * (level - 1);
}

export function levelFromXp(xp: number): { level: number; into: number; next: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL && remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level++;
  }
  return { level, into: remaining, next: level >= MAX_LEVEL ? 0 : xpForNext(level) };
}

/** XP earned for a single round. */
export function roundXp(points: number, rank: number, participated: boolean): number {
  if (!participated) return 2;
  return 10 + Math.floor(Math.max(0, Math.min(1000, points)) / 25) + (rank === 1 ? 10 : 0);
}

export const SESSION_XP = { finish: 40, win: 100, podium: 40 } as const;
