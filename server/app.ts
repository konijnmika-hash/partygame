// Composition root: wires database, HTTP API, realtime layer and the room manager together.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import { config } from './config';
import { createRepos, type Repos } from './db/index';
import { Recorder } from './progression/recorder';
import { RoomManager } from './rooms/manager';
import type { RoomTransport } from './rooms/room';
import { Presence } from './realtime/presence';
import { originAllowed, setupSockets } from './realtime/socket';
import { createHttpApp } from './http/app';
import { realClock } from './engine/runner';
import { GAME_DEFS } from './games/index';
import type { GameDef } from './engine/types';

export interface StartOptions {
  port?: number;
  host?: string;
  dbPath?: string;
  quiet?: boolean;
  /** test-only: run the game/room clock faster than real time */
  speed?: number;
}

export interface RunningServer {
  url: string;
  port: number;
  repos: Repos;
  manager: RoomManager;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  close(): Promise<void>;
}

export function loadGames(): Map<string, GameDef> {
  const map = new Map<string, GameDef>();
  for (const g of GAME_DEFS) {
    if (map.has(g.id)) throw new Error(`duplicate game def ${g.id}`);
    map.set(g.id, g);
  }
  return map;
}

function acceleratedClock(speed: number) {
  const base = Date.now();
  return { now: () => base + (Date.now() - base) * speed };
}

export async function startServer(opts: StartOptions = {}): Promise<RunningServer> {
  const repos = createRepos(opts.dbPath ?? config.dbPath);
  const recorder = new Recorder(repos);
  const games = loadGames();
  const presence = new Presence();
  const httpServer = http.createServer();
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    maxHttpBufferSize: 400_000,
    pingInterval: 10_000,
    pingTimeout: 20_000,
    allowRequest: (req, cb) => cb(null, originAllowed(req.headers.origin, req.headers.host)),
    connectionStateRecovery: undefined,
  });
  const transport: RoomTransport = {
    toChannel: (ch, ev, ...a) => (io.to(ch) as any).emit(ev, ...a),
    toSocket: (sid, ev, ...a) => (io.to(sid) as any).emit(ev, ...a),
    join: (sid, ch) => {
      io.sockets.sockets.get(sid)?.join(ch);
    },
    leave: (sid, ch) => {
      io.sockets.sockets.get(sid)?.leave(ch);
    },
  };
  const manager = new RoomManager({
    transport,
    clock: opts.speed && opts.speed > 1 ? acceleratedClock(opts.speed) : realClock,
    recorder,
    games,
    rttOf: (sid) => presence.rttOf(sid),
    maxRooms: config.maxRooms,
    log: opts.quiet ? () => {} : console.error,
  });
  const app = createHttpApp({
    repos,
    recorder,
    manager,
    presence,
    available: () => [...games.keys()],
    notifyUser: (userId, ev, payload) => {
      for (const sid of presence.socketsOf(userId)) (io.to(sid) as any).emit(ev, payload);
    },
  });
  httpServer.on('request', app);
  setupSockets(io, { repos, manager, presence });
  manager.start();
  const purge = setInterval(() => repos.users.purgeExpired(), 6 * 3600_000);
  purge.unref();

  await new Promise<void>((resolve) => httpServer.listen(opts.port ?? config.port, opts.host ?? config.host, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  if (!opts.quiet) console.log(`🎉 Bloop Bash server on http://localhost:${port} (${games.size} minigames loaded)`);
  return {
    url: `http://localhost:${port}`,
    port,
    repos,
    manager,
    io,
    async close() {
      clearInterval(purge);
      manager.shutdown();
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      repos.db.close();
    },
  };
}
