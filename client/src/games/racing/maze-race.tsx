import './racing.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DIRS } from '@shared/maze';
import { applyView, fitWorld, toWorld, roundRect, drawBloop, text, type Viewport } from '../../game/canvas';
import { Countdown, DPad, MiniScores, RankPill, useKeys } from '../../game/kit';
import { isTouchDevice } from '../../game/input';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'run' | 'done';
  deadline: number;
  maze: { w: number; h: number; cells: number[]; exit: number } | null;
  pos: Record<string, number>;
  finished: Record<string, { ms: number; place: number }>;
  scores: Record<string, number>;
}

const CELL = 60;
const DIR_OF = { up: 0, right: 1, down: 2, left: 3 } as const;

export default function MazeRace({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<Viewport | null>(null);
  const [local, setLocal] = useState<number>(pub.pos[me] ?? 0);
  const localRef = useRef(local);
  localRef.current = local;
  const lastSent = useRef(0);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const trail = useRef<number[]>([]);
  const done = !!pub.finished[me];
  const canMove = isPlayer && pub.phase === 'run' && !done;

  // new maze: reset local position
  useEffect(() => {
    setLocal(pub.pos[me] ?? 0);
    trail.current = [];
  }, [pub.i]);
  // reconcile with the server if we drift (e.g. a move was rejected)
  useEffect(() => {
    const srv = pub.pos[me];
    if (srv == null) return;
    const t = setTimeout(() => {
      if (pubRef.current.pos[me] !== localRef.current) setLocal(pubRef.current.pos[me]);
    }, 450);
    return () => clearTimeout(t);
  }, [pub.pos[me], local]);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string; place: number };
    if (ev.type === 'exit') {
      if (d.id === me) {
        sfx(d.place === 1 ? 'win' : 'cheer');
        vibrate([60, 40, 60]);
      } else sfx('ding');
    }
  }, false), [me]);

  const move = (d: number) => {
    const m = pub.maze;
    if (!canMove || !m) return;
    const now = performance.now();
    if (now - lastSent.current < 70) return;
    const c = localRef.current;
    if (!(m.cells[c] & DIRS[d].bit)) {
      sfx('buzz', 0.6);
      return;
    }
    lastSent.current = now;
    const n = c + DIRS[d].dy * m.w + DIRS[d].dx;
    trail.current.push(c);
    if (trail.current.length > 60) trail.current.shift();
    setLocal(n);
    sfx('tap', 1.3);
    send({ t: 'mv', d });
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  const touch = isTouchDevice();
  // keyboard (the on-screen D-pad handles keys itself when it is shown)
  useKeys((k, e) => {
    const map: Record<string, number> = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };
    if (map[k] != null) {
      e.preventDefault();
      moveRef.current(map[k]);
    }
  }, canMove && !touch);
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const frame = () => {
      const p = pubRef.current;
      const m = p.maze;
      if (m) {
        const W = m.w * CELL;
        const H = m.h * CELL;
        const view = fitWorld(cv, W + 20, H + 20, 4);
        viewRef.current = view;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        applyView(ctx, view);
        ctx.translate(10, 10);
        ctx.fillStyle = '#f4f0ff';
        roundRect(ctx, -6, -6, W + 12, H + 12, 14);
        ctx.fill();
        // exit
        const ex = (m.exit % m.w) * CELL;
        const ey = Math.floor(m.exit / m.w) * CELL;
        ctx.fillStyle = '#7af0a8';
        ctx.fillRect(ex + 4, ey + 4, CELL - 8, CELL - 8);
        text(ctx, '🏁', ex + CELL / 2, ey + CELL / 2, 32);
        // my trail
        ctx.fillStyle = 'rgba(255,210,63,0.35)';
        for (const c of trail.current) ctx.fillRect((c % m.w) * CELL + 18, Math.floor(c / m.w) * CELL + 18, CELL - 36, CELL - 36);
        // walls
        ctx.strokeStyle = '#3b2e6e';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let c = 0; c < m.cells.length; c++) {
          const x = (c % m.w) * CELL;
          const y = Math.floor(c / m.w) * CELL;
          const v = m.cells[c];
          if (!(v & 1)) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + CELL, y);
          }
          if (!(v & 8)) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + CELL);
          }
          if (Math.floor(c / m.w) === m.h - 1 && !(v & 4)) {
            ctx.moveTo(x, y + CELL);
            ctx.lineTo(x + CELL, y + CELL);
          }
          if (c % m.w === m.w - 1 && !(v & 2)) {
            ctx.moveTo(x + CELL, y);
            ctx.lineTo(x + CELL, y + CELL);
          }
        }
        ctx.stroke();
        // rivals
        for (const [id, c] of Object.entries(p.pos)) {
          if (id === me) continue;
          drawBloop(ctx, (c % m.w) * CELL + CELL / 2, Math.floor(c / m.w) * CELL + CELL / 2, 15, players.find((x) => x.id === id)?.avatar, { alpha: 0.45 });
        }
        if (p.pos[me] != null) {
          const c = localRef.current;
          drawBloop(ctx, (c % m.w) * CELL + CELL / 2, Math.floor(c / m.w) * CELL + CELL / 2, 20, players.find((x) => x.id === me)?.avatar, { me: true });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [players.length]);

  // swipe anywhere on the board, or tap toward a neighbouring cell
  const onUp = (e: React.PointerEvent) => {
    const st = down.current;
    down.current = null;
    const m = pub.maze;
    if (!canMove || !m || !viewRef.current || !st) return;
    const sdx = e.clientX - st.x;
    const sdy = e.clientY - st.y;
    if (Math.max(Math.abs(sdx), Math.abs(sdy)) >= 22) {
      move(Math.abs(sdx) > Math.abs(sdy) ? (sdx > 0 ? 1 : 3) : sdy > 0 ? 2 : 0);
      return;
    }
    const p = toWorld(viewRef.current, ref.current!, e.clientX, e.clientY);
    const cx = Math.floor((p.x - 10) / CELL);
    const cy = Math.floor((p.y - 10) / CELL);
    const c = localRef.current;
    const dx = cx - (c % m.w);
    const dy = cy - Math.floor(c / m.w);
    // tap a neighbouring cell (or anywhere in that direction)
    if (Math.abs(dx) + Math.abs(dy) === 0) return;
    const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    move(d);
  };

  const fin = pub.finished[me];
  return (
    <div className="g-stage full">
      <div className="mz-wrap">
        <div className="mz-top">
          <span className="ph-pill">Maze {pub.i + 1}/{pub.n}</span>
          <span style={{ flex: 1, minWidth: 100 }}><Countdown deadline={pub.phase === 'run' ? pub.deadline : null} total={60000} /></span>
          <span className="ph-pill gold">{fin ? `🏁 #${fin.place}` : `${Object.keys(pub.finished).length} escaped`}</span>
        </div>
        <div className="mz-box" onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })} onPointerUp={onUp}>
          <canvas ref={ref} />
        </div>
        {pub.phase === 'done' && <b>{Object.keys(pub.finished).length ? `${nm(players, Object.entries(pub.finished).find(([, f]) => f.place === 1)?.[0])} escaped first!` : 'Nobody escaped in time!'}</b>}
        {canMove && touch && <DPad onDir={(d) => move(DIR_OF[d])} />}
        <div className="row-nw" style={{ gap: 8 }}>
          <MiniScores players={players} scores={pub.scores} me={me} limit={3} />
          <RankPill scores={pub.scores} me={me} />
        </div>
      </div>
    </div>
  );
}
