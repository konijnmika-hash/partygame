import './physics.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { PZ, rampSeg, simulate, type PuzzleLevel, type Ramp } from '@shared/physicsPuzzle';
import { applyView, fitWorld, toWorld, roundRect, text, type Viewport } from '../../game/canvas';
import { Avatar } from '../../components/ui';
import { Countdown, MiniScores, useKeys } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'solve' | 'reveal';
  deadline: number;
  level: PuzzleLevel | null;
  solved: { id: string; ms: number; place: number }[];
  tries: Record<string, number>;
  solution: Ramp[] | null;
  scores: Record<string, number>;
}
interface Priv {
  tries: number;
  solved: boolean;
  last: { ok: boolean; reason: string; at: number; ramps: Ramp[] } | null;
}

const RAMP_COLORS = ['#ff8a3d', '#3da9fc', '#a46bff'];
const REASONS: Record<string, string> = { out: 'The ball flew off the board', stuck: 'The ball got stuck', timeout: 'Too slow — the ball never arrived' };

function clampRamp(r: Ramp): Ramp {
  return [Math.max(30, Math.min(PZ.W - 30, Math.round(r[0]))), Math.max(70, Math.min(PZ.H - 20, Math.round(r[1]))), Math.max(-PZ.MAX_A, Math.min(PZ.MAX_A, r[2]))];
}

function segDist(px: number, py: number, r: Ramp): number {
  const s = rampSeg(r);
  const ex = s.bx - s.ax;
  const ey = s.by - s.ay;
  const l2 = ex * ex + ey * ey || 1;
  const k = Math.max(0, Math.min(1, ((px - s.ax) * ex + (py - s.ay) * ey) / l2));
  return Math.hypot(px - (s.ax + ex * k), py - (s.ay + ey * k));
}

export default function PhysicsPuzzle({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, Priv>) {
  const level = pub.level;
  const ref = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<Viewport | null>(null);
  const [ramps, setRamps] = useState<(Ramp | null)[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [anim, setAnim] = useState<{ path: number[]; start: number; ok: boolean; reason: string; ghost: boolean } | null>(null);
  const drag = useRef<{ i: number; dx: number; dy: number } | null>(null);
  const state = useRef({ ramps, sel, anim, level, solution: pub.solution });
  state.current = { ramps, sel, anim, level, solution: pub.solution };
  const solvedMine = !!priv?.solved;
  const canEdit = isPlayer && pub.phase === 'solve' && !solvedMine && !anim;

  // new puzzle: empty tray
  useEffect(() => {
    setRamps(new Array(level?.ramps ?? 0).fill(null));
    setSel(null);
    setAnim(null);
  }, [pub.i]);

  // reveal: play the official solution
  useEffect(() => {
    if (pub.phase === 'reveal' && level && pub.solution) {
      const r = simulate(level, pub.solution, true);
      setAnim({ path: r.path ?? [], start: performance.now() + 400, ok: r.ok, reason: r.reason, ghost: true });
    }
  }, [pub.phase, pub.i]);

  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'solved') {
      const d = ev.data as { id: string };
      if (d.id !== me) sfx('ding');
    }
  }, false), [me]);

  const placed = ramps.filter((r): r is Ramp => !!r);
  const go = () => {
    if (!canEdit || !level || !placed.length) return;
    const r = simulate(level, placed, true);
    setAnim({ path: r.path ?? [], start: performance.now(), ok: r.ok, reason: r.reason, ghost: false });
    setSel(null);
    sfx('whoosh');
    send({ t: 'try', r: placed });
  };
  const rotate = (d: number) => {
    if (sel == null || !ramps[sel] || !canEdit) return;
    const next = [...ramps];
    next[sel] = clampRamp([ramps[sel]![0], ramps[sel]![1], ramps[sel]![2] + d]);
    setRamps(next);
    sfx('tick');
  };
  const removeSel = () => {
    if (sel == null || !canEdit) return;
    const next = [...ramps];
    next[sel] = null;
    setRamps(next);
    setSel(null);
  };
  useKeys((k) => {
    if (k === 'q' || k === 'Q') rotate(-1);
    else if (k === 'e' || k === 'E') rotate(1);
    else if (k === 'Enter') go();
    else if (k === 'Delete' || k === 'Backspace') removeSel();
  }, isPlayer);

  // playback finished -> feedback
  useEffect(() => {
    if (!anim) return;
    const dur = (anim.path.length / 2) * (1000 / 60) + 700;
    const t = setTimeout(() => {
      if (!anim.ghost) {
        sfx(anim.ok ? 'win' : 'wrong');
        if (anim.ok) vibrate([60, 40, 60]);
      }
      setAnim(null);
    }, Math.max(300, anim.start - performance.now()) + dur);
    return () => clearTimeout(t);
  }, [anim]);

  // canvas rendering
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const frame = () => {
      const { ramps: rs, sel: sl, anim: an, level: lv, solution } = state.current;
      const view = fitWorld(cv, PZ.W, PZ.H, 4);
      viewRef.current = view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      applyView(ctx, view);
      ctx.fillStyle = '#f4f0ff';
      roundRect(ctx, 0, 0, PZ.W, PZ.H, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(93,74,168,0.12)';
      ctx.lineWidth = 1;
      for (let x = 50; x < PZ.W; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, PZ.H);
        ctx.stroke();
      }
      for (let y = 50; y < PZ.H; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(PZ.W, y);
        ctx.stroke();
      }
      if (lv) {
        // cup
        const g = lv.goal;
        ctx.fillStyle = 'rgba(52,207,120,0.25)';
        ctx.fillRect(g.x, g.y, g.w, g.h);
        text(ctx, '⭐', g.x + g.w / 2, g.y + g.h / 2, 30);
        // walls
        ctx.lineCap = 'round';
        for (const w of lv.walls) {
          ctx.strokeStyle = '#3b2e6e';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(w.ax, w.ay);
          ctx.lineTo(w.bx, w.by);
          ctx.stroke();
        }
        // start pipe
        ctx.fillStyle = '#5d4aa8';
        roundRect(ctx, lv.start.x - 22, -10, 44, lv.start.y + 4, 8);
        ctx.fill();
        // ghost solution during the reveal
        const showRamps: { r: Ramp; color: string; selected: boolean }[] = [];
        if (solution && an?.ghost) solution.forEach((r) => showRamps.push({ r, color: '#34cf78', selected: false }));
        else rs.forEach((r, i) => r && showRamps.push({ r, color: RAMP_COLORS[i % RAMP_COLORS.length], selected: i === sl }));
        for (const { r, color, selected } of showRamps) {
          const s = rampSeg(r);
          if (selected) {
            ctx.strokeStyle = 'rgba(255,210,63,0.6)';
            ctx.lineWidth = 26;
            ctx.beginPath();
            ctx.moveTo(s.ax, s.ay);
            ctx.lineTo(s.bx, s.by);
            ctx.stroke();
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(s.ax, s.ay);
          ctx.lineTo(s.bx, s.by);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(r[0], r[1], 5, 0, Math.PI * 2);
          ctx.fill();
        }
        // ball
        let bx = lv.start.x;
        let by = lv.start.y;
        if (an) {
          const k = Math.max(0, Math.floor((performance.now() - an.start) / (1000 / 60)));
          const idx = Math.min(an.path.length / 2 - 1, k) * 2;
          if (an.path.length) {
            bx = an.path[idx];
            by = an.path[idx + 1];
          }
          const done = k >= an.path.length / 2 - 1;
          if (done) text(ctx, an.ok ? '🎉 GOAL!' : '❌ ' + (REASONS[an.reason] ?? 'Missed'), PZ.W / 2, 60, an.ok ? 54 : 30, an.ok ? '#1fb562' : '#e8304a');
        }
        const bg = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, PZ.R);
        bg.addColorStop(0, '#fff');
        bg.addColorStop(1, '#ff4f9a');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, by, PZ.R, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (!canEdit || !viewRef.current) return;
    const p = toWorld(viewRef.current, ref.current!, e.clientX, e.clientY);
    // grab the nearest placed ramp
    let hit = -1;
    let bd = 26;
    ramps.forEach((r, i) => {
      if (!r) return;
      const d = segDist(p.x, p.y, r);
      if (d < bd) {
        bd = d;
        hit = i;
      }
    });
    if (hit >= 0) {
      setSel(hit);
      drag.current = { i: hit, dx: ramps[hit]![0] - p.x, dy: ramps[hit]![1] - p.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      sfx('select');
      return;
    }
    // tap empty space: place the selected (or first unused) ramp here
    const idx = sel != null && !ramps[sel] ? sel : ramps.findIndex((r) => !r);
    if (idx >= 0) {
      const next = [...ramps];
      next[idx] = clampRamp([p.x, p.y, 0]);
      setRamps(next);
      setSel(idx);
      drag.current = { i: idx, dx: 0, dy: 0 };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      sfx('pop');
    } else setSel(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr || !viewRef.current || !canEdit) return;
    const p = toWorld(viewRef.current, ref.current!, e.clientX, e.clientY);
    const cur = ramps[dr.i];
    if (!cur) return;
    const next = [...ramps];
    next[dr.i] = clampRamp([p.x + dr.dx, p.y + dr.dy, cur[2]]);
    setRamps(next);
  };
  const onUp = () => {
    drag.current = null;
  };

  const last = priv?.last;
  const status = solvedMine
    ? { text: '✅ Solved! Waiting for the others…', cls: 'good' }
    : anim && !anim.ghost
      ? { text: 'Rolling…', cls: '' }
      : last && !last.ok
        ? { text: `❌ ${REASONS[last.reason] ?? 'Missed'} — tweak and retry!`, cls: 'bad' }
        : { text: 'Tap the board to place a ramp, drag to move, then GO!', cls: '' };

  return (
    <div className="g-stage full">
      <div className="pz-wrap">
        <div className="pz-top">
          <span className="ph-pill">Puzzle {pub.i + 1}/{pub.n}</span>
          <span style={{ flex: 1, minWidth: 120 }}><Countdown deadline={pub.phase === 'solve' ? pub.deadline : null} total={50000} /></span>
          <div className="row-nw" style={{ gap: 4 }}>
            {pub.solved.map((s) => (
              <span key={s.id} title={nm(players, s.id)} style={{ position: 'relative' }}>
                {player(s.id) && <Avatar avatar={player(s.id)!.avatar} size={30} />}
              </span>
            ))}
          </div>
        </div>
        <div className="pz-canvas-box" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <canvas ref={ref} />
        </div>
        {pub.phase === 'reveal' ? (
          <div className="pz-bar"><b>Here's one way to solve it 👆</b></div>
        ) : (
          <>
            <div className={`pz-status ${status.cls}`}>{status.text}</div>
            {isPlayer && !solvedMine && (
              <div className="pz-bar">
                {ramps.map((r, i) => (
                  <button key={i} className={`pz-ramp-btn ${r ? 'used' : ''} ${sel === i ? 'sel' : ''}`} style={{ borderBottom: `4px solid ${RAMP_COLORS[i % RAMP_COLORS.length]}` }} onClick={() => setSel(i)} disabled={!canEdit}>
                    ╱ Ramp {i + 1}
                  </button>
                ))}
                <button className="btn btn-blue" onClick={() => rotate(-1)} disabled={!canEdit || sel == null || !ramps[sel]} aria-label="Rotate left">⟲</button>
                <button className="btn btn-blue" onClick={() => rotate(1)} disabled={!canEdit || sel == null || !ramps[sel]} aria-label="Rotate right">⟳</button>
                <button className="btn" onClick={removeSel} disabled={!canEdit || sel == null || !ramps[sel]} aria-label="Remove ramp">🗑</button>
                <button className="btn btn-green" onClick={go} disabled={!canEdit || !placed.length}>GO ▶</button>
                <span className="small">Tries: {priv?.tries ?? 0}</span>
              </div>
            )}
          </>
        )}
        <MiniScores players={players} scores={pub.scores} me={me} limit={4} />
      </div>
    </div>
  );
}
