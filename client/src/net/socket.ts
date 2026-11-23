// Socket.IO client: connection lifecycle, clock sync and wiring server events into the store.
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import { ACHIEVEMENT_MAP } from '@shared/achievements';
import { addClockSample, hintServerTime } from './clock';
import { api } from './api';
import { addEmote, get, go, pushGameEvent, resetGame, set, toast } from '../state/store';
import { sfx } from '../audio/sfx';

type S = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: S | null = null;
let syncTimer: number | null = null;

export function getSocket(): S {
  if (!socket) throw new Error('socket not connected yet');
  return socket;
}

export function hasSocket(): boolean {
  return !!socket;
}

export function emit<E extends keyof ClientToServerEvents>(ev: E, ...args: Parameters<ClientToServerEvents[E]>): void {
  if (!socket) return;
  (socket.emit as any)(ev, ...args);
}

export function emitAck<T = unknown>(ev: keyof ClientToServerEvents, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) return resolve({ ok: false, error: 'Not connected — reconnecting...' });
    const timer = setTimeout(() => resolve({ ok: false, error: 'Server did not respond' }), 8000);
    (socket.emit as any)(ev, ...args, (r: Ack<T>) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
}

function syncClock(times = 4) {
  if (!socket) return;
  let n = 0;
  const once = () => {
    if (!socket?.connected) return;
    const sent = Date.now();
    socket.emit('time:ping', sent, (serverTime: number) => addClockSample(sent, serverTime, Date.now()));
    if (++n < times) setTimeout(once, 250);
  };
  once();
}

export async function refreshProfile(): Promise<void> {
  const r = await api('/me');
  if (r.ok && r.data) set({ profile: r.data });
}

export function connectSocket(): void {
  if (socket) return;
  const s: S = io({ withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelay: 600, reconnectionDelayMax: 4000 });
  socket = s;

  s.on('connect', () => {
    set({ connected: true, everConnected: true });
    syncClock(5);
    const pending = get().pendingJoin;
    if (pending) {
      set({ pendingJoin: null });
      joinRoom(pending);
    }
  });
  s.on('disconnect', () => set({ connected: false }));
  s.on('connect_error', async (err) => {
    set({ connected: false });
    if (err.message === 'unauthorized') {
      // session expired: get a fresh guest session then retry
      const r = await api('/auth/guest', { method: 'POST', body: {} });
      if (r.ok) set({ profile: r.data });
    }
  });
  s.io.on('reconnect', () => syncClock(3));

  if (syncTimer) clearInterval(syncTimer);
  syncTimer = window.setInterval(() => syncClock(2), 15000);

  s.on('sping', (_t, ack) => ack());
  s.on('presence', (p) => set({ online: p.online }));

  s.on('room:state', (room) => {
    hintServerTime(room.serverNow);
    const prev = get().room;
    const patch: any = { room };
    if (!prev || prev.code !== room.code) {
      patch.screen = 'room';
      patch.chat = [];
      patch.results = null;
      patch.final = null;
    }
    if (room.phase === 'lobby' && prev && prev.phase !== 'lobby') {
      patch.results = null;
      patch.final = null;
    }
    if (prev && prev.phase !== room.phase) {
      if (room.phase === 'intro') sfx('whoosh');
      if (room.phase === 'playing') sfx('go');
    }
    set(patch);
    updateUrl(room.code);
  });
  s.on('room:left', (reason) => {
    set({ room: null, results: null, final: null, chat: [] });
    resetGame(null);
    if (get().screen === 'room') go('home');
    updateUrl(null);
    if (reason === 'kicked') toast('You were removed from the room by the host.', 'error');
    else if (reason === 'timeout') toast('You were away too long and left the room.', 'info');
    else if (reason === 'closed') toast('The room closed.', 'info');
  });
  s.on('room:results', (r) => set({ results: r }));
  s.on('room:final', (f) => set({ final: f }));
  s.on('game:reset', (gameId) => resetGame(gameId));
  s.on('game:pub', (pub, t) => {
    hintServerTime(t);
    set((st) => ({ game: { ...st.game, pub, pubT: t, pubSeq: st.game.pubSeq + 1 } }));
  });
  s.on('game:priv', (priv) => set((st) => ({ game: { ...st.game, priv } })));
  s.on('game:asset', (key, data) => set((st) => ({ game: { ...st.game, assets: { ...st.game.assets, [key]: data } } })));
  s.on('game:event', (ev) => pushGameEvent(ev));
  s.on('chat', (msg) => {
    set((st) => ({ chat: [...st.chat.slice(-79), msg], unreadChat: st.unreadChat + 1 }));
    if (msg.from !== 'system' && msg.from !== get().profile?.id) sfx('blip');
  });
  s.on('chat:history', (msgs) => set({ chat: msgs }));
  s.on('emote', (from, emote) => addEmote(from, emote));
  s.on('toast', (t) => toast(t.text, t.kind));
  s.on('friends:update', () => set((st) => ({ online: st.online })));
  s.on('progress', (p) => {
    set((st) => ({ progress: [...st.progress, p] }));
    for (const a of p.achievements) {
      const def = ACHIEVEMENT_MAP[a];
      if (def) {
        toast(`Achievement unlocked: ${def.name}`, 'achievement', { emoji: def.emoji });
        sfx('achievement');
      }
    }
    for (const r of p.records) toast(`New personal record! ${r.label}: ${r.value}`, 'success', { emoji: '📈' });
    if (p.leveledUp) {
      toast(`Level up! You are now level ${p.level}`, 'achievement', { emoji: '⭐' });
      sfx('levelup');
    }
    refreshProfile();
  });
  s.on('invite', (inv) => {
    sfx('blip');
    toast(`${inv.from} invited you to a party!`, 'info', { emoji: '💌', action: { label: 'Join', run: () => joinRoom(inv.code) } });
  });
}

export async function joinRoom(code: string): Promise<boolean> {
  const r = await emitAck<{ code: string }>('room:join', code);
  if (!r.ok) {
    toast(r.error || 'Could not join', 'error');
    sfx('wrong');
    return false;
  }
  sfx('join');
  return true;
}

export async function createRoom(settings: any = null): Promise<boolean> {
  const r = await emitAck<{ code: string }>('room:create', settings);
  if (!r.ok) {
    toast(r.error || 'Could not create a room', 'error');
    return false;
  }
  sfx('join');
  return true;
}

export async function quickPlay(): Promise<boolean> {
  const r = await emitAck<{ code: string }>('match:quick');
  if (!r.ok) {
    toast(r.error || 'Matchmaking failed', 'error');
    return false;
  }
  sfx('join');
  return true;
}

export async function leaveRoom(): Promise<void> {
  await emitAck('room:leave');
  set({ room: null, results: null, final: null, chat: [] });
  resetGame(null);
  updateUrl(null);
  go('home');
}

function updateUrl(code: string | null) {
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch {
    /* ignore */
  }
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/?join=${code}`;
}
