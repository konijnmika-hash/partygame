// Startup: guest/session auth, catalog availability, socket connection, audio unlock.
import { api } from './net/api';
import { connectSocket, emit, emitAck } from './net/socket';
import { get, hadLocalSettings, saveLocalSettings, set } from './state/store';
import { setVolumes, unlockAudio } from './audio/sfx';
import { normalizeRoomCode } from '@shared/validation';
import { updateIfOutdated } from './net/freshReload';

let saveTimer: number | null = null;

export function applySettings(): void {
  const s = get().settings;
  setVolumes(s);
  (window as any).__bbHaptics = s.haptics;
  document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
}

/** Update settings locally (instant) and persist to the server profile (debounced). */
export function updateSettings(patch: Partial<ReturnType<typeof get>['settings']>): void {
  const next = { ...get().settings, ...patch };
  set({ settings: next });
  saveLocalSettings(next);
  applySettings();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { lastRoomSettings: _ignore, ...settings } = next as any;
    api('/me', { method: 'PATCH', body: { settings } });
  }, 600);
}

export async function boot(): Promise<void> {
  applySettings();
  try {
    // automation handle for end-to-end tests (?debug=1); exposes nothing the socket API doesn't already allow
    if (new URLSearchParams(window.location.search).has('debug') || sessionStorage.getItem('bb_debug')) {
      sessionStorage.setItem('bb_debug', '1');
      (window as any).__bb = { emit, emitAck, get, set };
    }
  } catch {
    /* storage blocked */
  }
  const params = new URLSearchParams(window.location.search);
  const join = normalizeRoomCode(params.get('join') || params.get('room') || '');
  if (join) set({ pendingJoin: join });

  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  let tries = 0;
  while (true) {
    const r = await api('/auth/guest', { method: 'POST', body: {} });
    if (r.ok && r.data) {
      const serverSettings = r.data.settings || {};
      const local = get().settings;
      // a fresh device adopts the account's saved settings; otherwise local changes win
      const merged = hadLocalSettings ? { ...serverSettings, ...local } : { ...local, ...serverSettings };
      set({ profile: r.data, authError: null, settings: merged });
      saveLocalSettings(merged);
      applySettings();
      break;
    }
    set({ authError: r.error || 'Could not reach the server' });
    tries++;
    await new Promise((res) => setTimeout(res, Math.min(8000, 800 * tries)));
  }
  // a browser-cached page from before a site update would fail to load its games
  void updateIfOutdated();
  const cat = await api<{ available: string[] }>('/catalog');
  if (cat.ok && cat.data) set({ available: new Set(cat.data.available) });
  connectSocket();
}
