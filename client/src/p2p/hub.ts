// Browser-hosted room server (static / GitHub Pages build). The player who creates a room runs
// the real room + game engine in their tab; everyone else (and the host's own UI) talks to it
// through "connections" that carry the same events the Node server uses over Socket.IO.
import type { PublicProfile } from '@shared/types';
import { sanitizeText } from '@shared/validation';
import { COSMETIC_MAP, DEFAULT_AVATAR } from '@shared/cosmetics';
import { RoomManager } from '../../../server/rooms/manager';
import type { Room, RoomTransport } from '../../../server/rooms/room';
import { realClock } from '../../../server/engine/runner';
import { GAME_DEFS } from '../../../server/games/index';
import { setDictionaryText } from '../../../server/content/words';
import type { GameDef } from '../../../server/engine/types';

/** One client of the hub (a remote peer or the host's own UI). */
export interface HubConn {
  /** deliver an event to the client; ack (if given) is called with the client's reply */
  send(ev: string, args: unknown[], ack?: (r: unknown) => void): void;
  close(): void;
}

class Bucket {
  private t: number;
  private last = Date.now();
  constructor(private cap: number, private rate: number) {
    this.t = cap;
  }
  take(): boolean {
    const now = Date.now();
    this.t = Math.min(this.cap, this.t + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.t < 1) return false;
    this.t--;
    return true;
  }
}

interface Client {
  conn: HubConn;
  userId: string;
  profile: PublicProfile;
  rtt: number;
  ping: number;
  limits: Record<'action' | 'input' | 'room' | 'chat' | 'ping', Bucket>;
}

function cleanProfile(p: any): PublicProfile | null {
  if (!p || typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{6,40}$/.test(p.id)) return null;
  const name = sanitizeText(p.name, 16) || 'Bloop';
  const a = p.avatar && typeof p.avatar === 'object' ? p.avatar : {};
  const pick = (k: keyof typeof DEFAULT_AVATAR) => (typeof a[k] === 'string' && COSMETIC_MAP[a[k]] ? a[k] : DEFAULT_AVATAR[k]);
  return {
    id: p.id,
    name,
    avatar: { color: pick('color'), eyes: pick('eyes'), mouth: pick('mouth'), hat: pick('hat'), acc: pick('acc') },
    level: Math.max(1, Math.min(100, Number(p.level) | 0 || 1)),
    title: sanitizeText(p.title, 24),
  };
}

let dictLoad: Promise<void> | null = null;
/** Word games need the dictionary; it is a separate static file fetched once by the host. */
export function loadDictionary(): Promise<void> {
  if (!dictLoad) {
    dictLoad = fetch(`${import.meta.env.BASE_URL}words.txt`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('words'))))
      .then((t) => setDictionaryText(t))
      .catch(() => {
        dictLoad = null;
      });
  }
  return dictLoad;
}

export class Hub {
  readonly manager: RoomManager;
  private clients = new Map<string, Client>();
  private channels = new Map<string, Set<string>>();
  private seq = 0;
  private timer: number;
  closed = false;

  constructor(readonly code: string) {
    const games = new Map<string, GameDef>(GAME_DEFS.map((g) => [g.id, g]));
    const transport: RoomTransport = {
      toChannel: (ch, ev, ...a) => {
        for (const sid of this.channels.get(ch) ?? []) this.clients.get(sid)?.conn.send(ev, a);
      },
      toSocket: (sid, ev, ...a) => this.clients.get(sid)?.conn.send(ev, a),
      join: (sid, ch) => {
        let set = this.channels.get(ch);
        if (!set) this.channels.set(ch, (set = new Set()));
        set.add(sid);
      },
      leave: (sid, ch) => this.channels.get(ch)?.delete(sid),
    };
    this.manager = new RoomManager({
      transport,
      clock: realClock,
      recorder: null,
      games,
      rttOf: (sid) => this.clients.get(sid)?.rtt ?? 0,
      maxRooms: 1,
      log: console.error,
    });
    this.manager.start();
    // latency probes + online count
    this.timer = window.setInterval(() => {
      for (const [, c] of this.clients) {
        const t = Date.now();
        c.conn.send('sping', [t], () => (c.rtt = c.rtt ? c.rtt * 0.7 + (Date.now() - t) * 0.3 : Date.now() - t));
        c.conn.send('presence', [{ online: this.clients.size }]);
      }
    }, 3000);
  }

  get room(): Room | undefined {
    return this.manager.rooms.get(this.code);
  }

  /** A client connected and introduced itself. Returns its connection id (or null if refused). */
  connect(conn: HubConn, rawProfile: unknown): string | null {
    const profile = cleanProfile(rawProfile);
    if (!profile || this.closed) return null;
    const sid = `c${++this.seq}`;
    this.clients.set(sid, {
      conn,
      userId: profile.id,
      profile,
      rtt: 0,
      ping: 0,
      limits: { action: new Bucket(80, 50), input: new Bucket(60, 40), room: new Bucket(12, 4), chat: new Bucket(5, 1), ping: new Bucket(6, 3) },
    });
    // reconnect: re-attach to the room this player belongs to
    this.manager.roomOf(profile.id)?.attach(profile.id, sid);
    conn.send('presence', [{ online: this.clients.size }]);
    return sid;
  }

  disconnect(sid: string): void {
    const c = this.clients.get(sid);
    if (!c) return;
    this.clients.delete(sid);
    for (const set of this.channels.values()) set.delete(sid);
    this.manager.roomOf(c.userId)?.detach(c.userId, sid);
  }

  /** An event from a client. */
  handle(sid: string, ev: string, args: unknown[]): void {
    const c = this.clients.get(sid);
    if (!c) return;
    const last = args[args.length - 1];
    const ack = typeof last === 'function' ? (last as (r: unknown) => void) : null;
    if (ack) args = args.slice(0, -1);
    const userId = c.userId;
    const fail = (error: string) => ack?.({ ok: false, error });
    const guard = () => {
      if (c.limits.room.take()) return true;
      fail('Slow down!');
      return false;
    };
    const room = () => this.manager.roomOf(userId);
    const enter = (r: Room | string) => {
      if (typeof r === 'string') return fail(r);
      r.attach(userId, sid);
      ack?.({ ok: true, data: { code: r.code } });
    };
    switch (ev) {
      case 'room:create': {
        if (!ack || !guard()) return;
        // one room per hub: creating again just re-enters it
        if (this.room) return enter(this.manager.join(c.profile, this.code));
        const s = args[0];
        return enter(this.manager.create(c.profile, s && typeof s === 'object' ? (s as any) : null, false, this.code));
      }
      case 'room:join':
        if (!ack || !guard()) return;
        return enter(this.manager.join(c.profile, args[0]));
      case 'match:quick':
        return fail('Quick Play is not available here. Create a room and share the link!');
      case 'room:leave':
        this.manager.leave(userId);
        return ack?.({ ok: true });
      case 'room:ready':
        return void (guard() && room()?.setReady(userId, args[0] === true));
      case 'room:skip':
        return void (guard() && room()?.skip(userId));
      case 'room:settings': {
        if (!guard()) return;
        const r = room();
        if (!r) return fail('Not in a room');
        const err = r.updateSettings(userId, args[0]);
        return ack?.(err ? { ok: false, error: err } : { ok: true });
      }
      case 'room:start': {
        if (!guard()) return;
        const r = room();
        if (!r) return fail('Not in a room');
        const err = r.start(userId);
        return ack?.(err ? { ok: false, error: err } : { ok: true });
      }
      case 'room:kick':
        return void (guard() && typeof args[0] === 'string' && room()?.kick(userId, args[0] as string));
      case 'room:bot': {
        if (!guard()) return;
        const r = room();
        if (!r) return;
        if (args[0] === 'add') {
          const err = r.addBot(userId);
          if (err) c.conn.send('toast', [{ kind: 'error', text: err }]);
        } else if (args[0] === 'remove') r.removeBot(userId);
        return;
      }
      case 'room:team':
        return void (guard() && room()?.setTeam(userId, Number(args[0])));
      case 'room:lobby':
        return void (guard() && room()?.backToLobby(userId));
      case 'room:again':
        return void (guard() && room()?.playAgain(userId));
      case 'room:soloBots': {
        if (!guard()) return;
        const err = room()?.soloWithBots(userId);
        if (err) c.conn.send('toast', [{ kind: 'info', text: err }]);
        return;
      }
      case 'chat:send':
        return void (c.limits.chat.take() && room()?.sendChat(userId, args[0]));
      case 'emote':
        return void (c.limits.chat.take() && room()?.emote(userId, args[0]));
      case 'game:action':
        return void (c.limits.action.take() && room()?.gameAction(userId, args[0]));
      case 'game:input': {
        const f = args[0];
        if (!c.limits.input.take() || !Array.isArray(f) || f.length < 3) return;
        return room()?.gameInput(userId, { x: Number(f[0]) || 0, y: Number(f[1]) || 0, b: Number(f[2]) | 0 });
      }
      case 'game:sync':
        return void (c.limits.room.take() && room()?.gameSync(userId, sid));
      case 'time:ping':
        return void (ack && c.limits.ping.take() && ack(Date.now()));
      case 'presence:list':
        return ack?.({ ok: true, data: { online: this.clients.size, rooms: [] } });
      default:
        return;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    this.manager.shutdown(); // tells everyone the room closed
    const conns = [...this.clients.values()].map((c) => c.conn);
    this.clients.clear();
    // give the goodbye messages a moment to arrive before hanging up
    setTimeout(() => conns.forEach((c) => c.close()), 1000);
  }
}
