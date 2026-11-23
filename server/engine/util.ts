import { sanitizeText } from '@shared/validation';
import type { GameCtx } from './types';

export function isObj(a: unknown): a is Record<string, any> {
  return !!a && typeof a === 'object' && !Array.isArray(a);
}

export function int(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return null;
  return v;
}

export function num(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return null;
  return v;
}

export function str(v: unknown, max: number, min = 1): string | null {
  const s = sanitizeText(v, max);
  return s.length >= min ? s : null;
}

export function intArray(v: unknown, maxLen: number, min: number, max: number): number[] | null {
  if (!Array.isArray(v) || v.length > maxLen) return null;
  for (const x of v) if (typeof x !== 'number' || !Number.isInteger(x) || x < min || x > max) return null;
  return v as number[];
}

/** Count votes: voter -> target. Returns target -> count. */
export function tally(votes: Record<string, string | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of Object.values(votes)) if (t) out[t] = (out[t] || 0) + 1;
  return out;
}

/** Participants that are human & connected, or bots (used for "everyone done?" checks). */
export function activeIds(ctx: GameCtx): string[] {
  return ctx.ids.filter((id) => ctx.isConnected(id));
}

export function allDone(ctx: GameCtx, done: (id: string) => boolean, among?: string[]): boolean {
  const list = (among ?? ctx.ids).filter((id) => ctx.isConnected(id));
  return list.length > 0 && list.every(done);
}

/**
 * Server-validated reaction time. The client reports how long after *seeing* the stimulus it
 * tapped; the server clamps that by what it observed itself (receive time minus round trip).
 */
export function reactionTime(ctx: GameCtx, pid: string, stimulusAt: number, clientMs: unknown): number {
  const serverMs = ctx.now() - stimulusAt;
  const rtt = Math.min(1000, ctx.rtt(pid));
  const hi = serverMs + 30;
  const lo = Math.max(0, serverMs - rtt - 200);
  let ms = typeof clientMs === 'number' && Number.isFinite(clientMs) ? clientMs : serverMs - rtt;
  ms = Math.max(lo, Math.min(hi, ms));
  return Math.max(80, Math.round(ms));
}

/** Linear speed points: full points at t=0 down to `min` at t=window. */
export function speedPoints(elapsed: number, windowMs: number, max: number, min = 0): number {
  const f = 1 - Math.max(0, Math.min(1, elapsed / windowMs));
  return Math.round(min + (max - min) * f);
}

/** Convert raw scores into perf 0..1 relative to a reference "great" score. */
export function perfFromScore(score: number, great: number): number {
  if (great <= 0) return 0;
  return Math.max(0, Math.min(1, score / great));
}

export function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

export function topBy<T>(arr: T[], f: (t: T) => number): T | undefined {
  let best: T | undefined;
  let bv = -Infinity;
  for (const t of arr) {
    const v = f(t);
    if (v > bv) {
      bv = v;
      best = t;
    }
  }
  return best;
}

export function fmtMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function fmtSec(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Simple phase controller with a deadline and an early-exit check. */
export class Phase<P extends string> {
  name: P;
  endsAt = 0;
  private timer: number | null = null;
  constructor(private ctx: GameCtx, initial: P) {
    this.name = initial;
  }
  to(name: P, ms: number | null, onEnd?: () => void): void {
    this.ctx.cancel(this.timer);
    this.timer = null;
    this.name = name;
    if (ms != null) {
      this.endsAt = this.ctx.now() + ms;
      if (onEnd) this.timer = this.ctx.after(ms, onEnd);
    } else this.endsAt = 0;
    this.ctx.dirty();
  }
  /** End the current phase now (runs the pending onEnd immediately via a 0ms timer). */
  cut(onEnd: () => void): void {
    this.ctx.cancel(this.timer);
    this.timer = this.ctx.after(0, onEnd);
    this.endsAt = this.ctx.now();
  }
  get timeLeft(): number {
    return Math.max(0, this.endsAt - this.ctx.now());
  }
}
