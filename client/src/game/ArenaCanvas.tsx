// Renders server-authoritative arena snapshots with smooth interpolation between updates.
import { useEffect, useRef } from 'react';
import { serverNow } from '../net/clock';
import { applyView, fitWorld, type Viewport } from './canvas';

export const INTERP_DELAY = 90;

interface Snap {
  t: number;
  pub: any;
}

export interface ArenaDrawCtx {
  view: Viewport;
  /** interpolated pub */
  s: any;
  /** latest (un-interpolated) pub */
  latest: any;
  /** render time in server ms */
  t: number;
  dt: number;
  cv: HTMLCanvasElement;
}

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function interpList(a: any[], b: any[], k: number): any[] {
  const byId = new Map<string, any>();
  for (const it of a) byId.set(String(it.id), it);
  return b.map((it) => {
    const prev = byId.get(String(it.id));
    if (!prev) return it;
    const o = { ...it };
    if (typeof it.x === 'number' && typeof prev.x === 'number' && Math.abs(it.x - prev.x) < 400) o.x = prev.x + (it.x - prev.x) * k;
    if (typeof it.y === 'number' && typeof prev.y === 'number' && Math.abs(it.y - prev.y) < 400) o.y = prev.y + (it.y - prev.y) * k;
    if (typeof it.a === 'number' && typeof prev.a === 'number') o.a = lerpAngle(prev.a, it.a, k);
    return o;
  });
}

export function ArenaCanvas({ pub, pubT, world, interp = ['p', 'o'], draw, onPointer }: {
  pub: any;
  pubT: number;
  world: { w: number; h: number };
  interp?: string[];
  draw: (ctx: CanvasRenderingContext2D, d: ArenaDrawCtx) => void;
  onPointer?: (e: PointerEvent, view: Viewport, cv: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const snaps = useRef<Snap[]>([]);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const viewRef = useRef<Viewport | null>(null);

  useEffect(() => {
    if (!pub) return;
    const arr = snaps.current;
    if (arr.length && arr[arr.length - 1].t >= pubT) arr[arr.length - 1] = { t: pubT, pub };
    else arr.push({ t: pubT, pub });
    while (arr.length > 20) arr.shift();
  }, [pub, pubT]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const view = fitWorld(cv, world.w, world.h);
      viewRef.current = view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const arr = snaps.current;
      if (arr.length) {
        const rt = serverNow() - INTERP_DELAY;
        let a = arr[0];
        let b = arr[arr.length - 1];
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i].t <= rt && arr[i + 1].t >= rt) {
            a = arr[i];
            b = arr[i + 1];
            break;
          }
        }
        let s = b.pub;
        if (a !== b && b.t > a.t) {
          const k = Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t)));
          s = { ...b.pub };
          for (const key of interp) if (Array.isArray(a.pub?.[key]) && Array.isArray(b.pub?.[key])) s[key] = interpList(a.pub[key], b.pub[key], k);
        }
        applyView(ctx, view);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, world.w, world.h);
        ctx.clip();
        drawRef.current(ctx, { view, s, latest: arr[arr.length - 1].pub, t: rt, dt, cv });
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [world.w, world.h]);

  useEffect(() => {
    if (!onPointer) return;
    const cv = ref.current!;
    const h = (e: PointerEvent) => viewRef.current && onPointer(e, viewRef.current, cv);
    cv.addEventListener('pointerdown', h);
    return () => cv.removeEventListener('pointerdown', h);
  }, [onPointer]);

  return (
    <div className="arena-wrap">
      <canvas ref={ref} className="arena-canvas" />
    </div>
  );
}
