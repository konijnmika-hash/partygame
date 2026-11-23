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
    l = lazy(loader as () => Promise<{ default: ComponentType<GameViewProps> }>);
    lazies.set(id, l);
  }
  return l;
}

/** Warm the chunk during the intro screen so the game starts instantly. */
export function preloadView(id: string): void {
  loaders.get(id)?.().catch(() => {});
}
