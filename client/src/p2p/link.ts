// Static-hosting transport: a drop-in replacement for the Socket.IO client. Creating a room
// starts a Hub in this tab and publishes it under a PeerJS id derived from the room code;
// joining connects straight to that tab over WebRTC. Event names, acks and payloads are the
// same as with the Node server, so the rest of the app doesn't know the difference.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCode } from '@shared/validation';
import type { PublicProfile } from '@shared/types';
import { Hub, loadDictionary, type HubConn } from './hub';

const PREFIX = 'bloopbash-party-';
type Fn = (...a: any[]) => void;

function peerOptions(): PeerOptions {
  const env = import.meta.env;
  const o: PeerOptions = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
  if (env.VITE_PEER_HOST) Object.assign(o, { host: env.VITE_PEER_HOST, port: Number(env.VITE_PEER_PORT || 9000), path: env.VITE_PEER_PATH || '/', secure: env.VITE_PEER_SECURE === '1' });
  return o;
}

interface Backend {
  emit(ev: string, args: unknown[]): void;
  close(): void;
  local: boolean;
  code: string;
}

function randomCode(): string {
  const b = new Uint32Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => ROOM_CODE_ALPHABET[x % ROOM_CODE_ALPHABET.length]).join('');
}

/** Wire format: ['e', ev, args, ackId|0] and ['a', ackId, result]. */
type Msg = ['e', string, unknown[], number] | ['a', number, unknown] | ['hello', unknown];

export class P2PSocket {
  private handlers = new Map<string, Set<Fn>>();
  private ioHandlers = new Map<string, Set<Fn>>();
  private backend: Backend | null = null;
  private hub: Hub | null = null;
  private hostPeer: Peer | null = null;
  private _connected = false;
  readonly io = { on: (ev: string, fn: Fn) => this.addTo(this.ioHandlers, ev, fn) };

  constructor(private profile: () => PublicProfile | null) {
    setTimeout(() => this.setConnected(true), 0);
    window.addEventListener('beforeunload', (e) => {
      const r = this.hub?.room;
      if (r && [...r.members.values()].some((m: any) => !m.isBot && m.id !== this.profile()?.id)) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  private addTo(map: Map<string, Set<Fn>>, ev: string, fn: Fn) {
    let s = map.get(ev);
    if (!s) map.set(ev, (s = new Set()));
    s.add(fn);
  }

  on(ev: string, fn: Fn): this {
    this.addTo(this.handlers, ev, fn);
    return this;
  }

  private fire(ev: string, args: unknown[]) {
    for (const fn of this.handlers.get(ev) ?? []) {
      try {
        fn(...args);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private setConnected(v: boolean) {
    if (this._connected === v) return;
    this._connected = v;
    this.fire(v ? 'connect' : 'disconnect', []);
  }

  emit(ev: string, ...args: unknown[]): this {
    const last = args[args.length - 1];
    const ack = typeof last === 'function' ? (last as Fn) : null;
    const plain = ack ? args.slice(0, -1) : args;
    if (ev === 'room:create') void this.create(plain, ack);
    else if (ev === 'room:join') void this.join(plain, ack);
    else if (ev === 'room:leave') this.leave(ack);
    else if (this.backend) this.backend.emit(ev, args);
    else if (ev === 'time:ping') ack?.(Date.now());
    else ack?.({ ok: false, error: 'Not in a room' });
    return this;
  }

  // ---------------------------------------------------------------- hosting

  private async create(args: unknown[], ack: Fn | null) {
    if (this.backend?.local) return this.backend.emit('room:create', [...args, ack]);
    this.dropBackend();
    void loadDictionary();
    let lastErr = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = randomCode();
      await loadDictionary();
      const hub = new Hub(code);
      try {
        this.hostPeer = await this.openHostPeer(code, hub);
        this.hub = hub;
        this.backend = this.localBackend(hub);
        this.backend.emit('room:create', [...args, ack]);
        return;
      } catch (e: any) {
        hub.close();
        lastErr = e?.message || String(e);
        if (e?.type !== 'unavailable-id') break;
      }
    }
    console.error('host failed', lastErr);
    ack?.({ ok: false, error: 'Could not reach the connection service. Check your internet and try again.' });
  }

  private openHostPeer(code: string, hub: Hub): Promise<Peer> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(PREFIX + code, peerOptions());
      let open = false;
      const t = setTimeout(() => {
        peer.destroy();
        reject(new Error('timeout'));
      }, 15000);
      peer.on('open', () => {
        open = true;
        clearTimeout(t);
        resolve(peer);
      });
      peer.on('error', (err: any) => {
        if (!open) {
          clearTimeout(t);
          peer.destroy();
          reject(err);
        }
      });
      // keep accepting newcomers if the signalling link drops
      peer.on('disconnected', () => {
        if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1500);
      });
      peer.on('connection', (dc) => this.acceptPeer(dc, hub));
    });
  }

  private acceptPeer(dc: DataConnection, owner: Hub) {
    // always the hub that owns this peer id (never a later one: connection ids restart per hub)
    const hub = () => (owner.closed ? null : owner);
    let sid: string | null = null;
    const acks = new Map<number, Fn>();
    let seq = 0;
    const conn: HubConn = {
      send: (ev, args, ack) => {
        if (!dc.open) return;
        let id = 0;
        if (ack) {
          id = ++seq;
          acks.set(id, ack);
          setTimeout(() => acks.delete(id), 8000);
        }
        try {
          dc.send(['e', ev, args, id] satisfies Msg);
        } catch {
          /* channel closing */
        }
      },
      close: () => dc.close(),
    };
    dc.on('data', (raw) => {
      const m = raw as Msg;
      if (!Array.isArray(m)) return;
      const h = hub();
      if (!h) return dc.close();
      if (m[0] === 'hello' && !sid) {
        sid = h.connect(conn, m[1]);
        if (!sid) dc.close();
      } else if (m[0] === 'e' && sid && typeof m[1] === 'string' && Array.isArray(m[2])) {
        const id = Number(m[3]) || 0;
        const args = id ? [...m[2], (r: unknown) => dc.open && dc.send(['a', id, r] satisfies Msg)] : m[2];
        h.handle(sid, m[1], args);
      } else if (m[0] === 'a') {
        const fn = acks.get(Number(m[1]));
        acks.delete(Number(m[1]));
        fn?.(m[2]);
      }
    });
    dc.on('close', () => sid && hub()?.disconnect(sid));
    dc.on('error', () => sid && hub()?.disconnect(sid));
  }

  /** The host's own UI talks to its hub without any network. */
  private localBackend(hub: Hub): Backend {
    const me = this.profile();
    const conn: HubConn = {
      send: (ev, args, ack) => queueMicrotask(() => this.fire(ev, ack ? [...args, ack] : args)),
      close: () => {},
    };
    const sid = hub.connect(conn, me)!;
    return {
      local: true,
      code: hub.code,
      emit: (ev, args) => queueMicrotask(() => hub.handle(sid, ev, args)),
      close: () => hub.disconnect(sid),
    };
  }

  // ---------------------------------------------------------------- joining

  private async join(args: unknown[], ack: Fn | null) {
    const code = normalizeRoomCode(String(args[0] ?? ''));
    if (!code) return ack?.({ ok: false, error: 'Room codes are 4 letters' });
    if (this.backend && this.backend.code === code) return this.backend.emit('room:join', [code, ack]);
    this.dropBackend();
    try {
      this.backend = await this.remoteBackend(code);
      this.backend.emit('room:join', [code, ack]);
    } catch (e: any) {
      ack?.({ ok: false, error: e?.message || 'Could not join' });
    }
  }

  private remoteBackend(code: string): Promise<Backend> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerOptions());
      const acks = new Map<number, Fn>();
      let seq = 0;
      let dc: DataConnection | null = null;
      let closed = false;
      let settled = false;
      let retryUntil = 0;
      const backend: Backend = {
        local: false,
        code,
        emit: (ev, args) => {
          const last = args[args.length - 1];
          const ack = typeof last === 'function' ? (last as Fn) : null;
          let id = 0;
          if (ack) {
            id = ++seq;
            acks.set(id, ack);
            setTimeout(() => {
              if (acks.delete(id)) ack({ ok: false, error: 'The host did not respond' });
            }, 10000);
          }
          if (dc?.open) dc.send(['e', ev, ack ? args.slice(0, -1) : args, id] satisfies Msg);
          else if (ack) {
            acks.delete(id);
            ack({ ok: false, error: 'Reconnecting to the host...' });
          }
        },
        close: () => {
          closed = true;
          peer.destroy();
        },
      };
      const fail = (msg: string) => {
        if (!settled) {
          settled = true;
          peer.destroy();
          reject(new Error(msg));
        }
      };
      const timer = setTimeout(() => fail('Could not reach that room. Is the code right and is the host still online?'), 15000);
      const dial = () => {
        if (closed) return;
        const c = peer.connect(PREFIX + code, { reliable: true });
        dc = c;
        c.on('open', () => {
          c.send(['hello', this.profile()] satisfies Msg);
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(backend);
          } else {
            this.setConnected(true);
            for (const fn of this.ioHandlers.get('reconnect') ?? []) fn();
          }
        });
        c.on('data', (raw) => {
          const m = raw as Msg;
          if (!Array.isArray(m)) return;
          if (m[0] === 'e' && typeof m[1] === 'string' && Array.isArray(m[2])) {
            const id = Number(m[3]) || 0;
            this.fire(m[1], id ? [...m[2], (r: unknown) => c.open && c.send(['a', id, r] satisfies Msg)] : m[2]);
            // removed from the room (left, kicked, closed): hang up
            if (m[1] === 'room:left' && this.backend === backend) this.dropBackend();
          } else if (m[0] === 'a') {
            const fn = acks.get(Number(m[1]));
            acks.delete(Number(m[1]));
            fn?.(m[2]);
          }
        });
        c.on('close', () => {
          if (closed || dc !== c) return;
          if (!settled) return fail('Could not join');
          // host tab hiccup / network switch: keep trying for a while
          this.setConnected(false);
          if (!retryUntil) retryUntil = Date.now() + 60_000;
          if (Date.now() < retryUntil) setTimeout(dial, 1500);
          else this.hostGone();
        });
      };
      peer.on('open', dial);
      peer.on('error', (err: any) => {
        if (err?.type === 'peer-unavailable') {
          if (!settled) fail('Room not found. Check the code — the host must keep their tab open.');
          else if (retryUntil && Date.now() < retryUntil) setTimeout(dial, 2000);
          else if (settled) this.hostGone();
        } else if (!settled) fail('Could not reach the connection service. Check your internet.');
      });
      peer.on('disconnected', () => !closed && !peer.destroyed && setTimeout(() => !peer.destroyed && peer.reconnect(), 1500));
    });
  }

  private hostGone() {
    this.dropBackend();
    this.setConnected(true);
    this.fire('room:left', ['closed']);
  }

  private leave(ack: Fn | null) {
    const b = this.backend;
    const hub = this.hub;
    const hostPeer = this.hostPeer;
    // detach now so a new room can start right away; hang up shortly after the message is out
    // (a host leaving closes the party for everyone)
    this.backend = null;
    this.hub = null;
    this.hostPeer = null;
    if (b) {
      b.emit('room:leave', []);
      setTimeout(() => {
        b.close();
        hub?.close();
        hostPeer?.destroy();
      }, 300);
    }
    ack?.({ ok: true });
  }

  private dropBackend() {
    this.backend?.close();
    this.backend = null;
    if (this.hub) {
      this.hub.close();
      this.hub = null;
    }
    if (this.hostPeer) {
      this.hostPeer.destroy();
      this.hostPeer = null;
    }
  }
}
