import type { MyProfile, PublicProfile } from '@shared/types';
import { levelFromXp } from '@shared/levels';
import { COSMETIC_MAP } from '@shared/cosmetics';
import type { Repos } from '../db/index';
import { parseAvatar, parseSettings, type UserRow } from '../db/users';
import { toUserStats } from '../db/stats';

export function titleName(id: string): string {
  return COSMETIC_MAP[id]?.name || 'Rookie';
}

export function publicProfile(u: UserRow): PublicProfile {
  return { id: u.id, name: u.username, avatar: parseAvatar(u.avatar), level: u.level, title: titleName(u.title) };
}

export interface MyProfileWire extends MyProfile {
  titleId: string;
}

export function myProfile(repos: Repos, u: UserRow): MyProfileWire {
  const lv = levelFromXp(u.xp);
  const stats = repos.stats.get(u.id);
  return {
    ...publicProfile(u),
    titleId: u.title,
    username: u.username,
    registered: !!u.password_hash,
    xp: u.xp,
    level: lv.level,
    xpIntoLevel: lv.into,
    xpForNext: lv.next,
    unlocked: repos.users.unlocks(u.id),
    achievements: repos.users.achievements(u.id),
    settings: parseSettings(u.settings),
    stats: toUserStats(stats, repos.stats.distinctGames(u.id)),
    createdAt: u.created_at,
  };
}
