// Client-side minigame registry: every game view lives in games/<category>/<id>.tsx and is
// code-split, so phones only download the games actually being played.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameViewProps } from './types';

const modules = import.meta.glob('../games/**/*.tsx');

const loaders = new Map<string, () => Promise<any>>();
for (const [path, loader] of Object.entries(modules)) {
  const id = path.split('/').pop()!.replace(/\.tsx$/, '');
  if (!id.startsWith('_')) loaders.set(id, loader as () => Promise<any>);
}

const lazies = new Map<string, LazyExoticComponent<ComponentType<GameViewProps>>>();

export function hasView(id: string): boolean {
  return loaders.has(id);
}

export function viewIds(): string[] {
  return [...loaders.keys()];
}

export function getView(id: string): LazyExoticComponent<ComponentType<GameViewProps>> | null {
  const loader = loaders.get(id);
  if (!loader) return null;
  let l = lazies.get(id);
  if (!l) {
    l = lazy(() => withRetry(loader) as Promise<{ default: ComponentType<GameViewProps> }>);
    lazies.set(id, l);
  }
  return l;
}

/** Drop a cached (failed) view so the next render downloads it again. */
export function forgetView(id: string): void {
  lazies.delete(id);
}

/** A flaky phone connection shouldn't break a round: try the download a few times. */
async function withRetry<T>(load: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await load();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
}

/** True when a code chunk could not be downloaded (offline, or the site was updated meanwhile). */
export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Loading chunk|ChunkLoadError|Unable to preload/i.test(msg);
}

/** Warm the chunk during the intro screen so the game starts instantly. */
export function preloadView(id: string): void {
  loaders.get(id)?.().catch(() => {});
}
