import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Avatar, LeaderboardScope, UserSettings } from '@shared/types';
import { COSMETIC_MAP } from '@shared/cosmetics';
import { validatePassword, validateUsername } from '@shared/validation';
import type { Repos } from '../db/index';
import type { UserRow } from '../db/users';
import { parseAvatar, parseSettings } from '../db/users';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { clearTokenCookie, setTokenCookie, tokenFromRequest } from '../auth/session';
import { myProfile, publicProfile } from '../progression/profile';
import type { Recorder } from '../progression/recorder';
import type { RoomManager } from '../rooms/manager';
import type { Presence } from '../realtime/presence';
import { clientIp, httpLimit, KeyedLimiter } from '../realtime/rateLimit';
import { config } from '../config';

export interface HttpDeps {
  repos: Repos;
  recorder: Recorder;
  manager: RoomManager;
  presence: Presence;
  available: () => string[];
  notifyUser: (userId: string, ev: 'friends:update' | 'toast' | 'progress', payload?: unknown) => void;
}

type AuthedRequest = Request & { user: UserRow };

const settingsSchema = z
  .object({
    sfxVolume: z.number().min(0).max(1),
    musicVolume: z.number().min(0).max(1),
    sfxMuted: z.boolean(),
    musicMuted: z.boolean(),
    reducedMotion: z.boolean(),
    haptics: z.boolean(),
  })
  .partial()
  .strict();

const avatarSchema = z
  .object({ color: z.string().max(32), eyes: z.string().max(32), mouth: z.string().max(32), hat: z.string().max(32), acc: z.string().max(32) })
  .strict();

const patchSchema = z
  .object({
    username: z.string().max(40),
    avatar: avatarSchema,
    titleId: z.string().max(40),
    settings: settingsSchema,
  })
  .partial()
  .strict();

const credsSchema = z.object({ username: z.string().max(40), password: z.string().max(200) }).strict();

export function apiRouter(deps: HttpDeps): Router {
  const { repos, recorder, manager, presence } = deps;
  const r = Router();
  const loginByName = new KeyedLimiter(8, 8 / (15 * 60)); // 8 attempts / 15 min per username

  const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = tokenFromRequest(req);
    const user = token ? repos.users.userByToken(token, config.sessionDays) : null;
    if (!user) {
      res.status(401).json({ ok: false, error: 'Not signed in' });
      return;
    }
    (req as AuthedRequest).user = user;
    next();
  };
  const me = (req: Request) => (req as AuthedRequest).user;
  const fresh = (id: string) => repos.users.byId(id)!;

  r.get('/health', (_req, res) => {
    res.json({ ok: true, ...manager.stats(), online: presence.count(), games: deps.available().length });
  });

  r.get('/catalog', (_req, res) => {
    res.json({ ok: true, data: { available: deps.available() } });
  });

  // ---- auth ----
  r.post('/auth/guest', httpLimit(30, 3), (req, res) => {
    const token = tokenFromRequest(req);
    const existing = token ? repos.users.userByToken(token, config.sessionDays) : null;
    if (existing) {
      res.json({ ok: true, data: myProfile(repos, existing) });
      return;
    }
    const user = repos.users.create();
    const t = repos.users.createToken(user.id, req.headers['user-agent'], config.sessionDays);
    setTokenCookie(res, t);
    res.json({ ok: true, data: myProfile(repos, user), token: req.headers['x-want-token'] === '1' ? t : undefined });
  });

  r.post('/auth/register', httpLimit(10, 5), auth, async (req, res) => {
    const body = credsSchema.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ ok: false, error: 'Invalid request' });
    const u = me(req);
    if (u.password_hash) return void res.status(400).json({ ok: false, error: 'This account already has a password' });
    const name = validateUsername(body.data.username);
    if (!name.ok) return void res.status(400).json({ ok: false, error: name.error });
    const pw = validatePassword(body.data.password);
    if (!pw.ok) return void res.status(400).json({ ok: false, error: pw.error });
    if (!repos.users.setUsername(u.id, name.value)) return void res.status(409).json({ ok: false, error: 'That username is taken' });
    repos.users.setPassword(u.id, await hashPassword(pw.value));
    const progress = recorder.grant(u.id, 'register');
    syncRoomProfile(u.id);
    res.json({ ok: true, data: myProfile(repos, fresh(u.id)), progress });
  });

  r.post('/auth/login', httpLimit(10, 10), async (req, res) => {
    const body = credsSchema.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ ok: false, error: 'Invalid request' });
    const key = body.data.username.toLowerCase();
    if (!loginByName.take(key)) return void res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
    const user = repos.users.byUsername(body.data.username);
    const ok = user ? await verifyPassword(body.data.password, user.password_hash) : await verifyPassword('x', 'scrypt$16384$8$1$AAAA$AAAA').catch(() => false);
    if (!user || !ok) return void res.status(401).json({ ok: false, error: 'Wrong username or password' });
    const old = tokenFromRequest(req);
    if (old) repos.users.deleteToken(old);
    const t = repos.users.createToken(user.id, req.headers['user-agent'], config.sessionDays);
    setTokenCookie(res, t);
    res.json({ ok: true, data: myProfile(repos, user) });
  });

  r.post('/auth/logout', (req, res) => {
    const token = tokenFromRequest(req);
    if (token) repos.users.deleteToken(token);
    clearTokenCookie(res);
    res.json({ ok: true });
  });

  // ---- profile ----
  r.get('/me', auth, (req, res) => {
    res.json({ ok: true, data: myProfile(repos, me(req)) });
  });

  r.patch('/me', httpLimit(30, 30), auth, (req, res) => {
    const body = patchSchema.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ ok: false, error: 'Invalid profile update' });
    const u = me(req);
    const unlocked = new Set(repos.users.unlocks(u.id));
    const p = body.data;
    let progress = null;
    if (p.username != null && p.username !== u.username) {
      const name = validateUsername(p.username);
      if (!name.ok) return void res.status(400).json({ ok: false, error: name.error });
      if (!repos.users.setUsername(u.id, name.value)) return void res.status(409).json({ ok: false, error: 'That username is taken' });
    }
    if (p.avatar) {
      const a: Avatar = p.avatar;
      const kinds: [keyof Avatar, string][] = [['color', 'color'], ['eyes', 'eyes'], ['mouth', 'mouth'], ['hat', 'hat'], ['acc', 'acc']];
      for (const [k, kind] of kinds) {
        const item = COSMETIC_MAP[a[k]];
        if (!item || item.kind !== kind) return void res.status(400).json({ ok: false, error: `Unknown ${k}` });
        if (!unlocked.has(a[k])) return void res.status(403).json({ ok: false, error: `${item.name} is still locked` });
      }
      const before = JSON.stringify(parseAvatar(u.avatar));
      repos.users.setAvatar(u.id, a);
      if (before !== JSON.stringify(a)) progress = recorder.grant(u.id, 'customizer');
    }
    if (p.titleId != null) {
      const item = COSMETIC_MAP[p.titleId];
      if (!item || item.kind !== 'title') return void res.status(400).json({ ok: false, error: 'Unknown title' });
      if (!unlocked.has(p.titleId)) return void res.status(403).json({ ok: false, error: 'That title is still locked' });
      repos.users.setTitle(u.id, p.titleId);
    }
    if (p.settings) {
      const cur = parseSettings(u.settings);
      const next: UserSettings = { ...cur, ...p.settings };
      repos.users.setSettings(u.id, next);
    }
    syncRoomProfile(u.id);
    res.json({ ok: true, data: myProfile(repos, fresh(u.id)), progress });
  });

  function syncRoomProfile(userId: string) {
    const room = manager.roomOf(userId);
    const u = repos.users.byId(userId);
    if (room && u) room.updateProfile(publicProfile(u));
  }

  r.get('/profile/:id', auth, (req, res) => {
    const id = String(req.params.id);
    const u = repos.users.byId(id);
    if (!u) return void res.status(404).json({ ok: false, error: 'Player not found' });
    const full = myProfile(repos, u);
    res.json({
      ok: true,
      data: {
        profile: publicProfile(u),
        stats: full.stats,
        achievements: full.achievements,
        games: repos.stats.gameStats(id),
        records: repos.stats.records(id),
        online: presence.isOnline(id),
      },
    });
  });

  r.get('/history', auth, (req, res) => {
    res.json({ ok: true, data: repos.history.forUser(me(req).id, 25) });
  });

  r.get('/stats/games', auth, (req, res) => {
    const id = me(req).id;
    res.json({ ok: true, data: { games: repos.stats.gameStats(id), records: repos.stats.records(id) } });
  });

  // ---- leaderboards ----
  r.get('/leaderboard', httpLimit(60, 60), auth, (req, res) => {
    const scope = String(req.query.scope || 'weekly') as LeaderboardScope;
    if (!['daily', 'weekly', 'alltime', 'friends'].includes(scope)) return void res.status(400).json({ ok: false, error: 'Bad scope' });
    const data = repos.leaderboard.get(scope, me(req).id, 50, (id) => presence.isOnline(id));
    res.json({ ok: true, data });
  });

  // ---- friends ----
  r.get('/friends', auth, (req, res) => {
    const rows = repos.friends.list(me(req).id).map((f) => {
      const act = manager.activityOf(f.id);
      const online = presence.isOnline(f.id);
      return {
        id: f.id,
        name: f.username,
        avatar: parseAvatar(f.avatar),
        level: f.level,
        title: COSMETIC_MAP[f.title]?.name ?? 'Rookie',
        status: f.status,
        online,
        activity: online ? act.activity : 'Offline',
        roomCode: online && f.status === 'friends' ? act.roomCode : null,
      };
    });
    res.json({ ok: true, data: rows });
  });

  r.post('/friends/request', httpLimit(20, 20), auth, (req, res) => {
    const name = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const target = name ? repos.users.byUsername(name) : undefined;
    const u = me(req);
    if (!target) return void res.status(404).json({ ok: false, error: 'No player with that username' });
    if (target.id === u.id) return void res.status(400).json({ ok: false, error: "That's you, silly!" });
    const result = repos.friends.request(u.id, target.id);
    if (result === 'limit') return void res.status(429).json({ ok: false, error: 'Too many pending requests' });
    if (result === 'accepted') {
      const p1 = recorder.grant(u.id, 'friend-1');
      const p2 = recorder.grant(target.id, 'friend-1');
      if (p2) deps.notifyUser(target.id, 'progress', p2);
      deps.notifyUser(target.id, 'friends:update');
      deps.notifyUser(target.id, 'toast', { kind: 'success', text: `${u.username} is now your friend!` });
      return void res.json({ ok: true, data: { result }, progress: p1 });
    }
    if (result === 'sent') {
      deps.notifyUser(target.id, 'friends:update');
      deps.notifyUser(target.id, 'toast', { kind: 'info', text: `${u.username} sent you a friend request` });
    }
    res.json({ ok: true, data: { result } });
  });

  r.post('/friends/accept', auth, (req, res) => {
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    const u = me(req);
    if (!repos.friends.accept(u.id, id)) return void res.status(400).json({ ok: false, error: 'No pending request' });
    const p1 = recorder.grant(u.id, 'friend-1');
    const p2 = recorder.grant(id, 'friend-1');
    if (p2) deps.notifyUser(id, 'progress', p2);
    deps.notifyUser(id, 'friends:update');
    deps.notifyUser(id, 'toast', { kind: 'success', text: `${u.username} accepted your friend request!` });
    res.json({ ok: true, progress: p1 });
  });

  r.post('/friends/remove', auth, (req, res) => {
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    repos.friends.remove(me(req).id, id);
    deps.notifyUser(id, 'friends:update');
    res.json({ ok: true });
  });

  r.get('/rooms/public', auth, (_req, res) => {
    res.json({ ok: true, data: manager.publicRooms() });
  });

  r.get('/ip', (req, res) => res.json({ ip: clientIp(req) }));

  return r;
}
