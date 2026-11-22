// Minimal headless client used by integration tests: HTTP guest auth + Socket.IO connection.
import { io, type Socket } from 'socket.io-client';

export interface TestUser {
  cookie: string;
  profile: any;
}

export async function api(url: string, path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const res = await fetch(url + path, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'bloopbash',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json()) as any;
  return { status: res.status, json, headers: res.headers };
}

export async function guest(url: string): Promise<TestUser> {
  const r = await api(url, '/api/auth/guest', { method: 'POST', body: {} });
  const set = r.headers.get('set-cookie') || '';
  const cookie = set.split(';')[0];
  if (!cookie.startsWith('bb_token=')) throw new Error('no cookie: ' + set);
  return { cookie, profile: r.json.data };
}

export function connect(url: string, cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { transports: ['websocket'], extraHeaders: { cookie }, reconnection: false, forceNew: true });
    s.on('sping', (_t: number, ack: () => void) => ack());
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => reject(e));
  });
}

export function waitFor<T = any>(s: Socket, ev: string, pred: (...a: any[]) => boolean = () => true, timeout = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off(ev, handler);
      reject(new Error(`timeout waiting for ${ev}`));
    }, timeout);
    const handler = (...args: any[]) => {
      if (pred(...args)) {
        clearTimeout(timer);
        s.off(ev, handler);
        resolve(args[0] as T);
      }
    };
    s.on(ev, handler);
  });
}

export function emitAck<T = any>(s: Socket, ev: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve) => s.emit(ev, ...args, (r: T) => resolve(r)));
}

/** Keeps the latest room state for a socket. */
export function trackState(s: Socket): { get(): any } {
  let last: any = null;
  s.on('room:state', (st: any) => (last = st));
  return { get: () => last };
}
