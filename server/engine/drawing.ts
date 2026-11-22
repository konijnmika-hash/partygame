// Shared drawing canvas management: validates stroke chunks, stores strokes, relays them live.
import type { GameCtx } from './types';
import { isObj } from './util';

export interface Stroke {
  k: string; // stroke key (pid:seq)
  by: string;
  c: number; // palette index
  w: number; // width 1..40
  p: number[]; // flat [x,y,x,y...] in 0..1000
}

export const PALETTE_SIZE = 16;
const MAX_POINTS_PER_MSG = 160;
const MAX_STROKES = 500;
const MAX_POINTS = 30000;

export interface DrawMsg {
  t: 'draw' | 'undo' | 'clear';
  cv: string;
  s?: number;
  c?: number;
  w?: number;
  p?: number[];
}

export class CanvasStore {
  canvases = new Map<string, Stroke[]>();
  points = new Map<string, number>();

  get(cv: string): Stroke[] {
    let c = this.canvases.get(cv);
    if (!c) {
      c = [];
      this.canvases.set(cv, c);
      this.points.set(cv, 0);
    }
    return c;
  }

  /**
   * Apply a draw message from `pid`. Returns the relay payload or null if invalid.
   * `allowed` decides whether the player may draw on that canvas right now.
   */
  apply(pid: string, a: unknown): { type: 'draw' | 'undo' | 'clear'; cv: string; data: any } | null {
    if (!isObj(a) || typeof a.cv !== 'string' || a.cv.length > 64) return null;
    const cv = a.cv;
    const strokes = this.get(cv);
    if (a.t === 'draw') {
      const s = a.s;
      if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 1e6) return null;
      if (!Array.isArray(a.p) || a.p.length < 2 || a.p.length > MAX_POINTS_PER_MSG * 2 || a.p.length % 2) return null;
      const pts: number[] = [];
      for (const v of a.p) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return null;
        pts.push(Math.max(0, Math.min(1000, Math.round(v))));
      }
      const key = `${pid}:${s}`;
      let stroke = strokes.find((st) => st.k === key);
      const total = this.points.get(cv) || 0;
      if (total + pts.length / 2 > MAX_POINTS) return null;
      if (!stroke) {
        if (strokes.length >= MAX_STROKES) return null;
        const c = typeof a.c === 'number' && Number.isInteger(a.c) && a.c >= 0 && a.c < PALETTE_SIZE ? a.c : 0;
        const w = typeof a.w === 'number' && Number.isFinite(a.w) ? Math.max(1, Math.min(40, Math.round(a.w))) : 6;
        stroke = { k: key, by: pid, c, w, p: [] };
        strokes.push(stroke);
      }
      stroke.p.push(...pts);
      this.points.set(cv, total + pts.length / 2);
      return { type: 'draw', cv, data: { cv, k: key, c: stroke.c, w: stroke.w, p: pts } };
    }
    if (a.t === 'undo') {
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].by === pid) {
          const [removed] = strokes.splice(i, 1);
          this.points.set(cv, Math.max(0, (this.points.get(cv) || 0) - removed.p.length / 2));
          return { type: 'undo', cv, data: { cv, k: removed.k } };
        }
      }
      return null;
    }
    if (a.t === 'clear') {
      const before = strokes.length;
      const keep = strokes.filter((st) => st.by !== pid);
      if (keep.length === before) return null;
      this.canvases.set(cv, keep);
      this.points.set(cv, keep.reduce((n, st) => n + st.p.length / 2, 0));
      return { type: 'clear', cv, data: { cv, by: pid } };
    }
    return null;
  }

  /** Compact copy for assets / galleries. */
  snapshot(cv: string): { c: number; w: number; p: number[] }[] {
    return this.get(cv).map((s) => ({ c: s.c, w: s.w, p: s.p }));
  }

  inkAmount(cv: string): number {
    return this.points.get(cv) || 0;
  }

  /** Send a full copy of a canvas to some players. */
  sync(ctx: GameCtx, cv: string, to?: string | string[]): void {
    ctx.event('canvas', { cv, strokes: this.get(cv).map((s) => ({ k: s.k, c: s.c, w: s.w, p: s.p })) }, to);
  }
}

/** Relay a draw/undo/clear result to the given recipients. */
export function relay(ctx: GameCtx, r: { type: string; data: unknown }, to?: string | string[]): void {
  ctx.event(r.type, r.data, to);
}

/** Bots scribble a random stroke (used for testing + bot fill). */
export function botScribble(cv: string, seq: number, rnd: () => number): DrawMsg {
  const p: number[] = [];
  let x = 200 + rnd() * 600;
  let y = 200 + rnd() * 600;
  for (let i = 0; i < 12; i++) {
    x = Math.max(0, Math.min(1000, x + (rnd() - 0.5) * 160));
    y = Math.max(0, Math.min(1000, y + (rnd() - 0.5) * 160));
    p.push(Math.round(x), Math.round(y));
  }
  return { t: 'draw', cv, s: seq, c: Math.floor(rnd() * 8), w: 6, p };
}
