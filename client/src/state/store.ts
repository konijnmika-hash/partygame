import { create } from 'zustand';
import type {
  ChatMessage, FinalResults, GameEventMsg, MyProfile, ProgressUpdate, RoomState, RoundResults, UserSettings,
} from '@shared/types';

export type Screen = 'home' | 'room' | 'leaderboard' | 'profile' | 'friends' | 'catalog' | 'settings';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success' | 'achievement';
  text: string;
  emoji?: string;
  action?: { label: string; run: () => void };
}

export interface Emote {
  id: number;
  from: string;
  emote: string;
  at: number;
}

export interface GameSlice {
  gameId: string | null;
  pub: any;
  pubT: number;
  pubSeq: number;
  priv: any;
  assets: Record<string, any>;
}

export interface MyProfileX extends MyProfile {
  titleId: string;
}

interface AppState {
  profile: MyProfileX | null;
  authError: string | null;
  connected: boolean;
  everConnected: boolean;
  online: number;
  screen: Screen;
  room: RoomState | null;
  results: RoundResults | null;
  final: FinalResults | null;
  chat: ChatMessage[];
  unreadChat: number;
  game: GameSlice;
  progress: ProgressUpdate[];
  toasts: Toast[];
  emotes: Emote[];
  available: Set<string>;
  pendingJoin: string | null;
  settings: UserSettings;
}

const LOCAL_SETTINGS = 'bb_settings';

export const hadLocalSettings = (() => {
  try {
    return !!localStorage.getItem(LOCAL_SETTINGS);
  } catch {
    return false;
  }
})();

function loadLocalSettings(): UserSettings {
  const d: UserSettings = { sfxVolume: 0.8, musicVolume: 0.45, sfxMuted: false, musicMuted: false, reducedMotion: false, haptics: true };
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS);
    if (raw) return { ...d, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return d;
}

export function saveLocalSettings(s: UserSettings): void {
  try {
    localStorage.setItem(LOCAL_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const useStore = create<AppState>(() => ({
  profile: null,
  authError: null,
  connected: false,
  everConnected: false,
  online: 0,
  screen: 'home',
  room: null,
  results: null,
  final: null,
  chat: [],
  unreadChat: 0,
  game: { gameId: null, pub: null, pubT: 0, pubSeq: 0, priv: null, assets: {} },
  progress: [],
  toasts: [],
  emotes: [],
  available: new Set(),
  pendingJoin: null,
  settings: loadLocalSettings(),
}));

export const set = useStore.setState;
export const get = useStore.getState;

let toastSeq = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', extra: Partial<Toast> = {}): void {
  const id = toastSeq++;
  set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text, ...extra }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), extra.action ? 9000 : 3800);
}

export function dismissToast(id: number): void {
  set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function go(screen: Screen): void {
  set({ screen });
  window.scrollTo({ top: 0 });
}

// ---------- game event bus (events are buffered so lazily-mounted views can replay them) ----------
type Handler = (ev: GameEventMsg) => void;
const handlers = new Set<Handler>();
let eventLog: GameEventMsg[] = [];

export function pushGameEvent(ev: GameEventMsg): void {
  eventLog.push(ev);
  if (eventLog.length > 4000) eventLog = eventLog.slice(-3000);
  for (const h of handlers) h(ev);
}

export function subscribeGameEvents(h: Handler, replay = true): () => void {
  if (replay) for (const ev of eventLog) h(ev);
  handlers.add(h);
  return () => handlers.delete(h);
}

export function resetGame(gameId: string | null): void {
  eventLog = [];
  set({ game: { gameId, pub: null, pubT: 0, pubSeq: 0, priv: null, assets: {} } });
}

let emoteSeq = 1;
export function addEmote(from: string, emote: string): void {
  const id = emoteSeq++;
  set((s) => ({ emotes: [...s.emotes.slice(-12), { id, from, emote, at: Date.now() }] }));
  setTimeout(() => set((s) => ({ emotes: s.emotes.filter((e) => e.id !== id) })), 2600);
}
