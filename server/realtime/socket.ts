// Socket.IO wiring: authenticated handshake, origin checks, rate limits, and event routing.
import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import type { Repos } from '../db/index';
import type { RoomManager } from '../rooms/manager';
import { publicProfile } from '../progression/profile';
import { tokenFromHeaders } from '../auth/session';
import { config } from '../config';
import { TokenBucket } from './rateLimit';
import type { Presence } from './presence';
import { Room } from '../rooms/room';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface RealtimeDeps {
  repos: Repos;
  manager: RoomManager;
  presence: Presence;
}

/** Same-origin (or explicitly allowed) handshakes only: blocks cross-site WebSocket hijacking. */
export function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (tests, native)
  try {
    const o = new URL(origin);
    if (host && o.host === host) return true;
    if (config.allowedOrigins.includes(origin)) return true;
    if (!config.isProd && (o.hostname === 'localhost' || o.hostname === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(o.hostname))) return true;
  } catch {
    return false;
  }
  return false;
}

export function setupSockets(io: IO, deps: RealtimeDeps): void {
  const { repos, manager, presence } = deps;

  io.use((socket, next) => {
    const h = socket.handshake;
    if (!originAllowed(h.headers.origin, h.headers.host)) return next(new Error('origin not allowed'));
    const authToken = typeof h.auth?.token === 'string' ? h.auth.token : undefined;
    const token = authToken || tokenFromHeaders({ cookie: h.headers.cookie, authorization: h.headers.authorization });
    const user = token ? repos.users.userByToken(token, config.sessionDays) : null;
    if (!user) return next(new Error('unauthorized'));
    socket.data.userId = user.id;
    next();
  });

  // broadcast online count periodically
  setInterval(() => io.emit('presence', { online: presence.count() }), 10_000).unref();

  io.on('connection', (socket: Sock) => {
    const userId: string = socket.data.userId;
    presence.add(userId, socket.id);
    repos.users.touch(userId);
    const limits = {
      action: new TokenBucket(80, 50),
      input: new TokenBucket(60, 40),
      room: new TokenBucket(12, 4),
      chat: new TokenBucket(5, 1),
      ping: new TokenBucket(6, 3),
    };
    const profile = () => {
      const u = repos.users.byId(userId);
      return u ? publicProfile(u) : null;
    };
    const fail = (ack: unknown, error: string) => {
      if (typeof ack === 'function') ack({ ok: false, error });
    };
    const roomGuard = (ack?: unknown): boolean => {
      if (!limits.room.take()) {
        fail(ack, 'Slow down!');
        return false;
      }
      return true;
    };

    // reconnect: re-attach to the room this user belongs to
    const existing = manager.roomOf(userId);
    if (existing) existing.attach(userId, socket.id);
    socket.emit('presence', { online: presence.count() });

    // latency measurement (server-initiated, used for timing validation)
    const pingTimer = setInterval(() => {
      const t = Date.now();
      socket.timeout(4000).emit('sping', t, (err: unknown) => {
        if (!err) presence.setRtt(socket.id, Date.now() - t);
      });
    }, 3000);

    const enterRoom = (room: Room | string, ack: (r: any) => void) => {
      if (typeof room === 'string') return ack({ ok: false, error: room });
      room.attach(userId, socket.id);
      ack({ ok: true, data: { code: room.code } });
    };

    socket.on('room:create', (settings, ack) => {
      if (typeof ack !== 'function' || !roomGuard(ack)) return;
      const p = profile();
      if (!p) return fail(ack, 'Profile missing');
      enterRoom(manager.create(p, settings && typeof settings === 'object' ? settings : null, false), ack);
    });

    socket.on('room:join', (code, ack) => {
      if (typeof ack !== 'function' || !roomGuard(ack)) return;
      const p = profile();
      if (!p) return fail(ack, 'Profile missing');
      enterRoom(manager.join(p, code), ack);
    });

    socket.on('match:quick', (ack) => {
      if (typeof ack !== 'function' || !roomGuard(ack)) return;
      const p = profile();
      if (!p) return fail(ack, 'Profile missing');
      enterRoom(manager.quickMatch(p), ack);
    });

    socket.on('room:leave', (ack) => {
      manager.leave(userId);
      if (typeof ack === 'function') ack({ ok: true });
    });

    const withRoom = (fn: (room: Room) => void) => {
      const room = manager.roomOf(userId);
      if (room) fn(room);
    };

    socket.on('room:ready', (ready) => roomGuard() && withRoom((r) => r.setReady(userId, ready === true)));
    socket.on('room:skip', () => roomGuard() && withRoom((r) => r.skip(userId)));
    socket.on('room:settings', (patch, ack) => {
      if (!roomGuard(ack)) return;
      const room = manager.roomOf(userId);
      if (!room) return fail(ack, 'Not in a room');
      const err = room.updateSettings(userId, patch);
      if (typeof ack === 'function') ack(err ? { ok: false, error: err } : { ok: true });
      if (!err) {
        const u = repos.users.byId(userId);
        if (u) {
          try {
            const s = JSON.parse(u.settings || '{}');
            s.lastRoomSettings = room.settings;
            repos.users.setSettings(userId, s);
          } catch {
            /* ignore */
          }
        }
      }
    });
    socket.on('room:start', (ack) => {
      if (!roomGuard(ack)) return;
      const room = manager.roomOf(userId);
      if (!room) return fail(ack, 'Not in a room');
      const err = room.start(userId);
      if (typeof ack === 'function') ack(err ? { ok: false, error: err } : { ok: true });
    });
    socket.on('room:kick', (target) => roomGuard() && typeof target === 'string' && withRoom((r) => r.kick(userId, target)));
    socket.on('room:bot', (op) => {
      if (!roomGuard()) return;
      withRoom((r) => {
        if (op === 'add') {
          const err = r.addBot(userId);
          if (err) socket.emit('toast', { kind: 'error', text: err });
        } else if (op === 'remove') r.removeBot(userId);
      });
    });
    socket.on('room:team', (team) => roomGuard() && withRoom((r) => r.setTeam(userId, Number(team))));
    socket.on('room:lobby', () => roomGuard() && withRoom((r) => r.backToLobby(userId)));
    socket.on('room:again', () => roomGuard() && withRoom((r) => r.playAgain(userId)));
    socket.on('room:soloBots', () => {
      if (!roomGuard()) return;
      withRoom((r) => {
        const err = r.soloWithBots(userId);
        if (err) socket.emit('toast', { kind: 'info', text: err });
      });
    });

    socket.on('chat:send', (text) => {
      if (!limits.chat.take()) return;
      withRoom((r) => r.sendChat(userId, text));
    });
    socket.on('emote', (e) => {
      if (!limits.chat.take()) return;
      withRoom((r) => r.emote(userId, e));
    });

    socket.on('game:action', (action) => {
      if (!limits.action.take()) return;
      withRoom((r) => r.gameAction(userId, action));
    });
    socket.on('game:input', (f) => {
      if (!limits.input.take() || !Array.isArray(f) || f.length < 3) return;
      withRoom((r) => r.gameInput(userId, { x: Number(f[0]) || 0, y: Number(f[1]) || 0, b: Number(f[2]) | 0 }));
    });
    socket.on('game:sync', () => {
      if (!limits.room.take()) return;
      withRoom((r) => r.gameSync(userId, socket.id));
    });

    socket.on('time:ping', (clientTime, ack) => {
      if (typeof ack !== 'function' || !limits.ping.take()) return;
      ack(Date.now());
    });

    socket.on('presence:list', (ack) => {
      if (typeof ack !== 'function' || !limits.room.take()) return;
      ack({ ok: true, data: { online: presence.count(), rooms: manager.publicRooms() } });
    });

    socket.on('friend:invite', (friendId) => {
      if (!limits.chat.take() || typeof friendId !== 'string') return;
      const room = manager.roomOf(userId);
      if (!room || room.isPublic) return;
      if (!repos.friends.friendIds(userId).includes(friendId)) return;
      const u = repos.users.byId(userId);
      if (!u) return;
      for (const sid of presence.socketsOf(friendId)) io.to(sid).emit('invite', { from: u.username, code: room.code });
    });

    socket.on('disconnect', () => {
      clearInterval(pingTimer);
      presence.remove(userId, socket.id);
      const room = manager.roomOf(userId);
      if (room) room.detach(userId, socket.id);
      repos.users.touch(userId);
    });
  });
}
