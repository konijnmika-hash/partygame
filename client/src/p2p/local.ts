// Static-hosting stand-in for the REST API: the profile, XP and settings live on this device.
// Leaderboards, friends and accounts need the online server and report that politely.
import type { MyProfile, RoundResults, FinalResults, UserStats } from '@shared/types';
import { CATALOG } from '@shared/catalog/index';
import { COSMETICS, COSMETIC_MAP, DEFAULT_AVATAR, defaultUnlocks, unlocksForLevel } from '@shared/cosmetics';
import { levelFromXp, roundXp, SESSION_XP } from '@shared/levels';
import { validateUsername } from '@shared/validation';
import type { ApiResult } from '../net/api';

const KEY = 'bb_local_profile_v1';
const ADJ = ['Bouncy', 'Wiggly', 'Jolly', 'Zippy', 'Fuzzy', 'Giddy', 'Snappy', 'Sparky', 'Bubbly', 'Cosmic', 'Sneaky', 'Dizzy', 'Peppy', 'Goofy', 'Lucky', 'Wobbly', 'Turbo', 'Mighty', 'Silly', 'Comfy'];
const NOUN = ['Bloop', 'Bean', 'Noodle', 'Pickle', 'Waffle', 'Muffin', 'Taco', 'Gummy', 'Pixel', 'Comet', 'Panda', 'Otter', 'Mochi', 'Nugget', 'Sprout', 'Jelly', 'Donut', 'Llama', 'Bagel', 'Kiwi'];

interface Stored {
  id: string;
  name: string;
  avatar: MyProfile['avatar'];
  titleId: string;
  xp: number;
  settings: Record<string, unknown>;
  stats: UserStats;
  createdAt: number;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const emptyStats = (): UserStats => ({ roundsPlayed: 0, roundsWon: 0, sessionsPlayed: 0, sessionsWon: 0, totalPoints: 0, bestRound: 0, perfectRounds: 0, roundStreak: 0, bestRoundStreak: 0, sessionStreak: 0, bestSessionStreak: 0, gamesHosted: 0, distinctGames: 0 });

function load(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s.id === 'string') return { ...s, stats: { ...emptyStats(), ...s.stats } };
  } catch {
    /* fresh */
  }
  const s: Stored = {
    id: `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
    name: `${pick(ADJ)}${pick(NOUN)}${Math.floor(Math.random() * 900 + 100)}`,
    avatar: { ...DEFAULT_AVATAR, color: pick(COSMETICS.filter((c) => c.kind === 'color' && c.unlock.type === 'default')).id },
    titleId: 't-rookie',
    xp: 0,
    settings: {},
    stats: emptyStats(),
    createdAt: Date.now(),
  };
  save(s);
  return s;
}

function save(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: profile lasts for this visit */
  }
}

let cur: Stored | null = null;
const me = () => (cur ??= load());

export function localProfile(): MyProfile & { titleId: string } {
  const s = me();
  const lv = levelFromXp(s.xp);
  const unlocked = [...new Set([...defaultUnlocks(), ...Array.from({ length: lv.level }, (_, i) => unlocksForLevel(i + 1)).flat()])];
  return {
    id: s.id,
    name: s.name,
    username: s.name,
    avatar: s.avatar,
    level: lv.level,
    title: COSMETIC_MAP[s.titleId]?.name ?? 'Rookie',
    titleId: s.titleId,
    registered: false,
    xp: s.xp,
    xpIntoLevel: lv.into,
    xpForNext: lv.next,
    unlocked,
    achievements: [],
    settings: s.settings as any,
    stats: s.stats,
    createdAt: s.createdAt,
  };
}

const NO_SERVER = 'Needs the online server — not available in this version.';

export async function localApi<T>(path: string, opts: { method?: string; body?: any }): Promise<ApiResult<T>> {
  const method = opts.method ?? 'GET';
  const p = path.split('?')[0];
  const ok = (data: unknown): ApiResult<T> => ({ ok: true, data: data as T });
  if (p === '/auth/guest' || (p === '/me' && method === 'GET')) return ok(localProfile());
  if (p === '/me' && method === 'PATCH') {
    const s = me();
    const b = opts.body ?? {};
    if (b.username !== undefined) {
      const v = validateUsername(b.username);
      if (!v.ok) return { ok: false, error: v.error };
      s.name = v.value;
    }
    if (b.avatar) {
      const have = new Set(localProfile().unlocked);
      for (const k of ['color', 'eyes', 'mouth', 'hat', 'acc'] as const) if (typeof b.avatar[k] === 'string' && have.has(b.avatar[k])) (s.avatar as any)[k] = b.avatar[k];
    }
    if (typeof b.titleId === 'string' && localProfile().unlocked.includes(b.titleId)) s.titleId = b.titleId;
    if (b.settings && typeof b.settings === 'object') s.settings = { ...s.settings, ...b.settings };
    save(s);
    return ok(localProfile());
  }
  if (p === '/catalog') return ok({ available: CATALOG.map((g) => g.id) });
  if (p === '/stats/games') return ok({ games: [], records: [] });
  if (p === '/history') return ok([]);
  return { ok: false, error: NO_SERVER };
}

/** XP for this device's player after a round / session (the host can't award it remotely). */
export function localRoundProgress(r: RoundResults): { gained: number; before: number; after: number } | null {
  const s = me();
  const p = r.players.find((x) => x.id === s.id);
  if (!p) return null;
  const before = levelFromXp(s.xp).level;
  const gained = roundXp(p.points, p.rank, p.points > 0);
  s.xp += gained;
  s.stats.roundsPlayed++;
  if (p.rank === 1) s.stats.roundsWon++;
  s.stats.totalPoints += p.points;
  s.stats.bestRound = Math.max(s.stats.bestRound, p.points);
  save(s);
  return { gained, before, after: levelFromXp(s.xp).level };
}

export function localFinalProgress(f: FinalResults): { gained: number; before: number; after: number } | null {
  const s = me();
  const st = f.standings.find((x) => x.id === s.id);
  if (!st) return null;
  const before = levelFromXp(s.xp).level;
  const gained = SESSION_XP.finish + (st.rank === 1 ? SESSION_XP.win : st.rank <= 3 ? SESSION_XP.podium : 0);
  s.xp += gained;
  s.stats.sessionsPlayed++;
  if (st.rank === 1) s.stats.sessionsWon++;
  save(s);
  return { gained, before, after: levelFromXp(s.xp).level };
}
