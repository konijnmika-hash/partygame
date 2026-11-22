import crypto from 'node:crypto';
import type { Avatar, UserSettings } from '@shared/types';
import { DEFAULT_AVATAR, defaultUnlocks, unlocksForLevel } from '@shared/cosmetics';
import { levelFromXp } from '@shared/levels';
import type { DB } from './database';

export interface UserRow {
  id: string;
  username: string;
  username_lc: string;
  password_hash: string | null;
  avatar: string;
  title: string;
  xp: number;
  level: number;
  settings: string;
  created_at: number;
  last_seen: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  sfxVolume: 0.8,
  musicVolume: 0.45,
  sfxMuted: false,
  musicMuted: false,
  reducedMotion: false,
  haptics: true,
};

const ADJ = ['Bouncy', 'Wiggly', 'Jolly', 'Zippy', 'Fuzzy', 'Giddy', 'Snappy', 'Sparky', 'Bubbly', 'Cosmic', 'Sneaky', 'Dizzy', 'Peppy', 'Goofy', 'Lucky', 'Wobbly', 'Turbo', 'Mighty', 'Silly', 'Comfy'];
const NOUN = ['Bloop', 'Bean', 'Noodle', 'Pickle', 'Waffle', 'Muffin', 'Taco', 'Gummy', 'Pixel', 'Comet', 'Panda', 'Otter', 'Mochi', 'Nugget', 'Sprout', 'Jelly', 'Donut', 'Llama', 'Bagel', 'Kiwi'];
const COLORS = ['c-bubblegum', 'c-sky', 'c-lime', 'c-sunny', 'c-tangerine', 'c-grape'];
const HATS = ['h-party', 'h-beanie', 'h-none'];
const EYES = ['e-round', 'e-happy', 'e-wink'];
const MOUTHS = ['m-smile', 'm-grin', 'm-open'];

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class UsersRepo {
  private s;
  constructor(private db: DB) {
    this.s = {
      insert: db.prepare(`INSERT INTO users (id, username, username_lc, avatar, title, xp, level, settings, created_at, last_seen)
        VALUES (@id, @username, @username_lc, @avatar, 't-rookie', 0, 1, @settings, @now, @now)`),
      insertStats: db.prepare(`INSERT INTO user_stats (user_id) VALUES (?)`),
      byId: db.prepare(`SELECT * FROM users WHERE id = ?`),
      byName: db.prepare(`SELECT * FROM users WHERE username_lc = ?`),
      setName: db.prepare(`UPDATE users SET username = ?, username_lc = ? WHERE id = ?`),
      setPw: db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`),
      setAvatar: db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`),
      setTitle: db.prepare(`UPDATE users SET title = ? WHERE id = ?`),
      setSettings: db.prepare(`UPDATE users SET settings = ? WHERE id = ?`),
      setXp: db.prepare(`UPDATE users SET xp = ?, level = ? WHERE id = ?`),
      touch: db.prepare(`UPDATE users SET last_seen = ? WHERE id = ?`),
      unlocks: db.prepare(`SELECT item_id FROM unlocks WHERE user_id = ?`),
      addUnlock: db.prepare(`INSERT OR IGNORE INTO unlocks (user_id, item_id, unlocked_at) VALUES (?, ?, ?)`),
      achievements: db.prepare(`SELECT achievement_id AS id, unlocked_at AS at FROM achievements WHERE user_id = ? ORDER BY unlocked_at`),
      addAch: db.prepare(`INSERT OR IGNORE INTO achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)`),
      insToken: db.prepare(`INSERT INTO auth_tokens (token_hash, user_id, created_at, last_used, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)`),
      tokenUser: db.prepare(`SELECT u.*, t.last_used AS t_last_used, t.expires_at AS t_expires FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`),
      touchToken: db.prepare(`UPDATE auth_tokens SET last_used = ?, expires_at = ? WHERE token_hash = ?`),
      delToken: db.prepare(`DELETE FROM auth_tokens WHERE token_hash = ?`),
      purge: db.prepare(`DELETE FROM auth_tokens WHERE expires_at < ?`),
      search: db.prepare(`SELECT * FROM users WHERE username_lc LIKE ? LIMIT 10`),
    };
  }

  create(username?: string): UserRow {
    const id = crypto.randomUUID();
    const now = Date.now();
    let name = username;
    for (let attempt = 0; !name || this.byUsername(name); attempt++) {
      const n = attempt < 20 ? Math.floor(Math.random() * 900) + 100 : Math.floor(Math.random() * 9000) + 1000;
      name = `${pick(ADJ)}${pick(NOUN)}${n}`;
      if (attempt > 60) name = `Bloop${crypto.randomInt(100000, 999999)}`;
    }
    const avatar: Avatar = { ...DEFAULT_AVATAR, color: pick(COLORS), hat: pick(HATS), eyes: pick(EYES), mouth: pick(MOUTHS) };
    this.db.transaction(() => {
      this.s.insert.run({ id, username: name, username_lc: name!.toLowerCase(), avatar: JSON.stringify(avatar), settings: JSON.stringify(DEFAULT_SETTINGS), now });
      this.s.insertStats.run(id);
      for (const item of [...defaultUnlocks(), ...unlocksForLevel(1)]) this.s.addUnlock.run(id, item, now);
    })();
    return this.byId(id)!;
  }

  byId(id: string): UserRow | undefined {
    return this.s.byId.get(id) as UserRow | undefined;
  }

  byUsername(name: string): UserRow | undefined {
    return this.s.byName.get(name.toLowerCase()) as UserRow | undefined;
  }

  search(prefix: string): UserRow[] {
    const safe = prefix.toLowerCase().replace(/[%_]/g, '');
    return this.s.search.all(`${safe}%`) as UserRow[];
  }

  /** returns false if the name is taken by someone else */
  setUsername(id: string, name: string): boolean {
    const other = this.byUsername(name);
    if (other && other.id !== id) return false;
    this.s.setName.run(name, name.toLowerCase(), id);
    return true;
  }

  setPassword(id: string, hash: string): void {
    this.s.setPw.run(hash, id);
  }

  setAvatar(id: string, avatar: Avatar): void {
    this.s.setAvatar.run(JSON.stringify(avatar), id);
  }

  setTitle(id: string, title: string): void {
    this.s.setTitle.run(title, id);
  }

  setSettings(id: string, settings: UserSettings): void {
    this.s.setSettings.run(JSON.stringify(settings), id);
  }

  /** Adds XP, recalculates level and unlocks level rewards. */
  addXp(id: string, amount: number): { xp: number; level: number; oldLevel: number; newUnlocks: string[] } {
    const u = this.byId(id);
    if (!u) return { xp: 0, level: 1, oldLevel: 1, newUnlocks: [] };
    const xp = u.xp + Math.max(0, Math.round(amount));
    const { level } = levelFromXp(xp);
    this.s.setXp.run(xp, level, id);
    const newUnlocks = level > u.level ? this.addUnlocks(id, unlocksForLevel(level)) : [];
    return { xp, level, oldLevel: u.level, newUnlocks };
  }

  touch(id: string): void {
    this.s.touch.run(Date.now(), id);
  }

  unlocks(id: string): string[] {
    return (this.s.unlocks.all(id) as { item_id: string }[]).map((r) => r.item_id);
  }

  addUnlocks(id: string, items: string[]): string[] {
    const now = Date.now();
    const added: string[] = [];
    for (const it of items) if (this.s.addUnlock.run(id, it, now).changes > 0) added.push(it);
    return added;
  }

  achievements(id: string): { id: string; at: number }[] {
    return this.s.achievements.all(id) as { id: string; at: number }[];
  }

  addAchievement(id: string, aid: string): boolean {
    return this.s.addAch.run(id, aid, Date.now()).changes > 0;
  }

  // ---- tokens ----
  createToken(userId: string, userAgent: string | undefined, days: number): string {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    this.s.insToken.run(hashToken(token), userId, now, now, now + days * 86400_000, (userAgent || '').slice(0, 200));
    return token;
  }

  userByToken(token: string, days: number): UserRow | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const h = hashToken(token);
    const row = this.s.tokenUser.get(h) as (UserRow & { t_last_used: number; t_expires: number }) | undefined;
    if (!row) return null;
    const now = Date.now();
    if (row.t_expires < now) {
      this.s.delToken.run(h);
      return null;
    }
    if (now - row.t_last_used > 3600_000) this.s.touchToken.run(now, now + days * 86400_000, h);
    return row;
  }

  deleteToken(token: string): void {
    this.s.delToken.run(hashToken(token));
  }

  purgeExpired(): void {
    this.s.purge.run(Date.now());
  }
}

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export function parseAvatar(s: string): Avatar {
  try {
    const a = JSON.parse(s);
    return { ...DEFAULT_AVATAR, ...a };
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

export function parseSettings(s: string): UserSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
