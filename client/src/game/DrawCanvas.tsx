// Drawing surface used by all drawing games: live stroke streaming, undo/clear, blind ink,
// palette + brush toolbar, and a read-only renderer for galleries.
import { useEffect, useRef, useState } from 'react';
import { PALETTE, BRUSH_SIZES } from '@shared/palette';
import { subscribeGameEvents } from '../state/store';
import { sfx } from '../audio/sfx';

export interface StrokeData {
  c: number;
  w: number;
  p: number[];
}

export function renderStrokes(ctx: CanvasRenderingContext2D, strokes: Iterable<StrokeData>, size: number, bg: string | null = '#ffffff', guide?: StrokeData[] | null, colorOverride?: string): void {
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }
  if (guide?.length) renderStrokes(ctx, guide, size, null, null, '#cfc6f2');
  const k = size / 1000;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    const p = s.p;
    if (p.length < 2) continue;
    ctx.strokeStyle = colorOverride ?? PALETTE[s.c] ?? '#000';
    ctx.lineWidth = Math.max(1, s.w * k);
    ctx.beginPath();
    ctx.moveTo(p[0] * k, p[1] * k);
    if (p.length === 2) ctx.lineTo(p[0] * k + 0.01, p[1] * k + 0.01);
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = ((p[i] + p[i + 2]) / 2) * k;
      const my = ((p[i + 1] + p[i + 3]) / 2) * k;
      ctx.quadraticCurveTo(p[i] * k, p[i + 1] * k, mx, my);
    }
    if (p.length >= 4) ctx.lineTo(p[p.length - 2] * k, p[p.length - 1] * k);
    ctx.stroke();
  }
}

function useCanvasSize(ref: React.RefObject<HTMLCanvasElement | null>) {
  const [size, setSize] = useState(0);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => setSize(cv.clientWidth));
    ro.observe(cv);
    setSize(cv.clientWidth);
    return () => ro.disconnect();
  }, []);
  return size;
}

/** Read-only drawing (for galleries / reveals). */
export function StrokesView({ strokes, className = '', guide, overlayColor }: { strokes: StrokeData[] | null | undefined; className?: string; guide?: StrokeData[] | null; overlayColor?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokes(ctx, strokes ?? [], size, '#ffffff', guide, overlayColor);
  }, [strokes, size, guide, overlayColor]);
  return <canvas ref={ref} className={`draw-canvas view ${className}`} />;
}

export function DrawCanvas({ cv, me, editable, blind = false, send, toolbar = true, limitColors, onStrokeEnd, onStrokeStart, maxStrokes, hideOthers = false, overlay, guide }: {
  cv: string;
  me: string;
  editable: boolean;
  blind?: boolean;
  send: (a: Record<string, unknown>) => void;
  toolbar?: boolean;
  limitColors?: number[];
  onStrokeEnd?: () => void;
  maxStrokes?: number;
  hideOthers?: boolean;
  overlay?: React.ReactNode;
  guide?: StrokeData[] | null;
  onStrokeStart?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef(new Map<string, StrokeData>());
  const [color, setColor] = useState(limitColors ? limitColors[0] : 0);
  const [width, setWidth] = useState(BRUSH_SIZES[1]);
  const seq = useRef(Math.floor(Math.random() * 1000) * 1000);
  const cur = useRef<{ key: string; buf: number[]; last: number } | null>(null);
  const dirty = useRef(true);
  const myCount = useRef(0);
  const size = useCanvasSize(ref);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(width);
  widthRef.current = width;
  const guideRef = useRef(guide);
  if (guideRef.current !== guide) {
    guideRef.current = guide;
    dirty.current = true;
  }

  useEffect(() => {
    strokes.current.clear();
    dirty.current = true;
    return subscribeGameEvents((ev) => {
      const d = ev.data as any;
      if (!d || d.cv !== cv) return;
      if (ev.type === 'draw') {
        if (editable && typeof d.k === 'string' && d.k.startsWith(me + ':')) return;
        const s = strokes.current.get(d.k);
        if (s) s.p.push(...d.p);
        else strokes.current.set(d.k, { c: d.c, w: d.w, p: [...d.p] });
      } else if (ev.type === 'undo') strokes.current.delete(d.k);
      else if (ev.type === 'clear') {
        for (const k of [...strokes.current.keys()]) if (k.startsWith(d.by + ':')) strokes.current.delete(k);
      } else if (ev.type === 'canvas') {
        strokes.current.clear();
        for (const s of d.strokes) strokes.current.set(s.k, { c: s.c, w: s.w, p: [...s.p] });
      } else return;
      dirty.current = true;
    });
  }, [cv, me, editable]);

  // render loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      const sz = sizeRef.current;
      if (el && sz && dirty.current) {
        dirty.current = false;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (el.width !== Math.round(sz * dpr)) {
          el.width = Math.round(sz * dpr);
          el.height = Math.round(sz * dpr);
        }
        const ctx = el.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const list = [...strokes.current.entries()].filter(([k]) => {
          const mine = k.startsWith(me + ':');
          if (blind && mine) return false;
          if (hideOthers && !mine) return false;
          return true;
        }).map(([, s]) => s);
        renderStrokes(ctx, list, sz, '#ffffff', guideRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [blind, me, hideOthers]);

  useEffect(() => {
    dirty.current = true;
  }, [size]);

  // each time drawing is (re-)enabled, the per-turn stroke limit starts over
  useEffect(() => {
    if (editable) myCount.current = 0;
  }, [editable]);

  const flush = () => {
    const c = cur.current;
    if (!c || c.buf.length < 2) return;
    const s = strokes.current.get(c.key)!;
    send({ t: 'draw', cv, s: Number(c.key.split(':')[1]), c: s.c, w: s.w, p: c.buf });
    c.buf = [];
    c.last = performance.now();
  };

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1000, Math.round(((e.clientX - r.left) / r.width) * 1000))), Math.max(0, Math.min(1000, Math.round(((e.clientY - r.top) / r.height) * 1000)))];
  };

  const down = (e: React.PointerEvent) => {
    if (!editable) return;
    if (maxStrokes != null && myCount.current >= maxStrokes) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const key = `${me}:${++seq.current}`;
    const [x, y] = pos(e);
    strokes.current.set(key, { c: colorRef.current, w: widthRef.current, p: [x, y] });
    cur.current = { key, buf: [x, y], last: performance.now() };
    myCount.current++;
    dirty.current = true;
    onStrokeStart?.();
    sfx('draw');
  };
  const move = (e: React.PointerEvent) => {
    const c = cur.current;
    if (!c) return;
    const s = strokes.current.get(c.key);
    if (!s) return;
    const [x, y] = pos(e);
    const lx = s.p[s.p.length - 2];
    const ly = s.p[s.p.length - 1];
    if (Math.abs(x - lx) + Math.abs(y - ly) < 4) return;
    s.p.push(x, y);
    c.buf.push(x, y);
    dirty.current = true;
    if (c.buf.length >= 120 || performance.now() - c.last > 60) flush();
  };
  const up = () => {
    if (!cur.current) return;
    flush();
    cur.current = null;
    onStrokeEnd?.();
  };

  const undo = () => {
    const mine = [...strokes.current.keys()].filter((k) => k.startsWith(me + ':'));
    const last = mine[mine.length - 1];
    if (!last) return;
    strokes.current.delete(last);
    myCount.current = Math.max(0, myCount.current - 1);
    dirty.current = true;
    send({ t: 'undo', cv });
    sfx('swap');
  };
  const clear = () => {
    for (const k of [...strokes.current.keys()]) if (k.startsWith(me + ':')) strokes.current.delete(k);
    myCount.current = 0;
    dirty.current = true;
    send({ t: 'clear', cv });
    sfx('whoosh');
  };

  const colors = limitColors ?? PALETTE.map((_, i) => i);
  return (
    <div className={`draw-wrap ${editable ? 'editable' : ''}`}>
      <div className="draw-stage">
        <canvas
          ref={ref}
          className={`draw-canvas ${blind ? 'blind' : ''}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={(e) => e.buttons === 0 && up()}
          style={{ touchAction: 'none', cursor: editable ? 'crosshair' : 'default' }}
        />
        {blind && editable && <div className="blind-note">🙈 Your ink is invisible to you!</div>}
        {overlay}
      </div>
      {editable && toolbar && (
        <div className="draw-tools">
          <div className="palette">
            {colors.map((ci) => (
              <button key={ci} className={`swatch ${ci === color ? 'on' : ''}`} style={{ background: PALETTE[ci] }} onClick={() => { setColor(ci); sfx('select'); }} aria-label={`Colour ${ci}`} />
            ))}
          </div>
          <div className="row-nw">
            {BRUSH_SIZES.map((w) => (
              <button key={w} className={`brush ${w === width ? 'on' : ''}`} onClick={() => setWidth(w)} aria-label={`Brush ${w}`}>
                <span style={{ width: Math.min(26, w), height: Math.min(26, w) }} />
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={undo} aria-label="Undo">↶</button>
            <button className="btn btn-ghost btn-sm" onClick={clear} aria-label="Clear">🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
