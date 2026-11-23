// Small helpers shared by memory game views (re-exports the kit for convenience).
import { useNow } from '../../components/ui';

export * from '../../game/kit';

/** Seconds (rounded up) until a server timestamp; null-safe. */
export function useSecondsLeftLocal(deadline: number | null | undefined): number {
  const now = useNow(100);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}
