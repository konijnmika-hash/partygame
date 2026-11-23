// Client-side prediction for "ghost" games: runs the same deterministic sim as the server,
// applies local input instantly, streams timestamped inputs and reconciles with the server.
import { useEffect, useMemo, useRef } from 'react';
import { GhostSim, quantize, inputEq, type GhostDef, type GInput } from '@shared/ghost';
import { serverNow } from '../net/clock';
import { readInput, startKeyboard } from './input';
import { applyView, fitWorld, type Viewport } from './canvas';

export interface GhostDrawCtx<W, S> {
  view: Viewport;
  world: W;
  me: S | null;
  prev: S | null;
  /** fraction (0..1) between prev and me for smooth rendering */
  alpha: number;
  tick: number;
  others: { id: string; s: any }[];
  started: boolean;
  done: boolean;
  dt: number;
}

export interface GhostPub {
  seed: number;
  t0: number;
  hz: number;
  diff: 'easy' | 'normal' | 'hard';
  p: Record<string, any>;
  done: string[];
}

export function GhostCanvas<W, S>({ def, pub, priv, me, isPlayer, send, worldSize, draw, inputMap, tapToA = true }: {
  def: GhostDef<W, S>;
  pub: GhostPub;
  priv: { k: number; s: S; d: boolean } | null;
  me: string;
  isPlayer: boolean;
  send: (a: Record<string, unknown>) => void;
  worldSize: (w: W) => { w: number; h: number };
  draw: (ctx: CanvasRenderingContext2D, d: GhostDrawCtx<W, S>) => void;
  /** optional remap of the raw input (e.g. swipe-to-turn games) */
  inputMap?: (raw: GInput) => GInput;
  /** tapping the canvas presses button A */
  tapToA?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const world = useMemo(() => def.world(pub.seed, pub.diff), [pub.seed, pub.diff]);
  const ids = Object.keys(pub.p);
  const myIndex = Math.max(0, ids.indexOf(me));
  const simRef = useRef<GhostSim<W, S> | null>(null);
  if (!simRef.current && isPlayer) simRef.current = new GhostSim(def, world, myIndex, ids.length, 90);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const tapRef = useRef(0);
  const mapRef = useRef(inputMap);
  mapRef.current = inputMap;
  const sizeRef = useRef(worldSize);
  sizeRef.current = worldSize;

  // reconcile with authoritative state
  useEffect(() => {
    const sim = simRef.current;
    if (!sim || !priv) return;
    const local = sim.snapshotAt(priv.k);
    if (local == null) return;
    if (JSON.stringify(local) !== JSON.stringify(priv.s)) sim.reconcile(priv.k, priv.s, priv.d);
    else if (priv.d && sim.doneAt == null) sim.doneAt = priv.k;
  }, [priv]);

  useEffect(() => {
    const stopKb = startKeyboard();
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const tickMs = 1000 / def.hz;
    let last: GInput = [0, 0, 0];
    let raf = 0;
    let lastFrame = performance.now();
    const frame = (nowP: number) => {
      const dt = Math.min(0.1, (nowP - lastFrame) / 1000);
      lastFrame = nowP;
      const p = pubRef.current;
      const sim = simRef.current;
      const elapsed = serverNow() - p.t0;
      const target = Math.max(0, Math.floor(elapsed / tickMs));
      if (sim) {
        let inp = quantize(readInput());
        if (tapRef.current > 0) {
          inp = [inp[0], inp[1], inp[2] | 1];
          tapRef.current--;
        }
        if (mapRef.current) inp = mapRef.current(inp);
        if (elapsed >= 0 && sim.doneAt == null && !inputEq(inp, last)) {
          const k = sim.tick;
          sim.applyInput(k, inp);
          send({ t: 'gi', k, i: inp });
          last = inp;
        }
        if (elapsed >= 0) sim.advanceTo(target);
      }
      const size = sizeRef.current(world);
      const view = fitWorld(cv, size.w, size.h, 4);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      applyView(ctx, view);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size.w, size.h);
      ctx.clip();
      const others = Object.entries(p.p).filter(([id]) => id !== me).map(([id, s]) => ({ id, s }));
      const tickFrac = elapsed > 0 ? (elapsed / tickMs) % 1 : 0;
      drawRef.current(ctx, {
        view,
        world,
        me: sim ? sim.state : null,
        prev: sim ? sim.snapshotAt(sim.tick - 1) : null,
        alpha: sim && sim.doneAt == null ? tickFrac : 1,
        tick: sim ? sim.tick : target,
        others,
        started: elapsed >= 0,
        done: sim ? sim.doneAt != null : true,
        dt,
      });
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      stopKb();
    };
  }, [world]);

  return (
    <div
      className="arena-wrap"
      onPointerDown={(e) => {
        if (!tapToA || !isPlayer) return;
        if ((e.target as HTMLElement).closest('.touch-controls')) return;
        tapRef.current = 3;
      }}
    >
      <canvas ref={ref} className="arena-canvas" />
    </div>
  );
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
