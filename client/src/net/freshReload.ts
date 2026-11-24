// Recovering from a site update. Every deploy renames the code files, and the old ones are
// deleted. A tab (or a browser-cached copy of the page, GitHub Pages caches it for 10 minutes)
// from before the update then asks for files that no longer exist. The only cure is loading the
// page again, past the cache, which we do once automatically.
import { P2P } from '../p2p/mode';
import { get } from '../state/store';

const KEY = 'bb_fresh_reload_at';
const PARAM = '_v';

/** In the browser-hosted build the room lives in the host's tab: reloading it ends the party. */
export function reloadEndsParty(): boolean {
  const s = get();
  return P2P && !!s.room && !!s.profile && s.room.hostId === s.profile.id;
}

/** Reload with a cache-busting URL. Returns false when we just did that (avoids reload loops). */
export function freshReload(force = false): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (!force && Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    if (!force) return false;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, Date.now().toString(36));
  window.location.replace(url.toString());
  return true;
}

/** Remove the cache-buster from the address bar after a fresh load. */
export function cleanFreshParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM)) return;
    url.searchParams.delete(PARAM);
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch {
    /* ignore */
  }
}

/** A lazily loaded file failed to download: reload once unless that would end the party. */
export function handleStaleBuild(): boolean {
  if (reloadEndsParty()) return false;
  return freshReload();
}

/** The page's own main script, e.g. ".../assets/index-AbC123.js" (null in development). */
function currentEntry(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src, window.location.href).pathname : null;
}

/** True when the site has been updated since this page was loaded (checked past every cache). */
export async function isOutdated(): Promise<boolean> {
  const mine = currentEntry();
  if (!mine) return false;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}?${PARAM}=${Date.now().toString(36)}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const m = (await r.text()).match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
    return !!m && new URL(m[1], window.location.href).pathname !== mine;
  } catch {
    return false; // offline: keep going with what we have
  }
}

/** Load the latest version if there is one (only when that can't break a running party). */
export async function updateIfOutdated(): Promise<boolean> {
  if (reloadEndsParty() || !(await isOutdated())) return false;
  return freshReload(); // at most once a minute, in case a cache keeps serving the old page
}
