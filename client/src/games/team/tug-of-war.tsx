import './team.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { applyView, drawBloop, fitWorld, text } from '../../game/canvas';
import { serverNow } from '../../net/clock';
import { teamColor, teamName } from '@shared/teams';
import { useKeys } from '../../game/kit';
import { TeamBar, myTeam } from './_team';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  round: number;
  rounds: number;
  phase: 'count' | 'pull' | 'result' | 'over';
  phaseEnds: number;
  beat0: number;
  beat: number;
  knot: { x: number; y: number };
  dirs: { x: number; y: number }[];
  win: number;
  teams: string[][];
  wins: number[];
  power: number[];
  roundWinner: number | null;
}

const W = 1000;
const H = 620;
const C = { x: 500, y: 300 };
const SCALE = 0.95;

export default function TugOfWar({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const knot = useRef({ x: 0, y: 0 });
  const beatRef = useRef<HTMLDivElement>(null);
  const mine = myTeam(pub.teams, me);
  const pulling = pub.phase === 'pull';
  const tap = () => {
    if (!isPlayer || !pulling) return;
    send({ t: 'tap' });
    vibrate(6);
    // on-beat feedback (the server judges the real thing)
    const ph = (((serverNow() - pub.beat0) % pub.beat) + pub.beat) % pub.beat;
    const err = Math.min(ph, pub.beat - ph);
    sfx(err < 95 ? 'blip' : 'tap', err < 95 ? 1.3 : 1);
  };
  useKeys((k) => {
    if (k === ' ' || k === 'Enter') tap();
  }, isPlayer && pulling);
  useEffect(() => {
    if (pub.phase === 'pull') sfx('go');
    if (pub.phase === 'result' && pub.roundWinner != null) sfx(pub.roundWinner === mine ? 'win' : 'lose');
  }, [pub.phase, pub.round]);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let lastBeat = -1;
    const frame = () => {
      const p = pubRef.current;
      const now = serverNow();
      knot.current.x += (p.knot.x - knot.current.x) * 0.25;
      knot.current.y += (p.knot.y - knot.current.y) * 0.25;
      const view = fitWorld(cv, W, H, 4);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      applyView(ctx, view);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#8fd3ff');
      g.addColorStop(1, '#d9f4ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7ccf63';
      ctx.fillRect(0, 380, W, H - 380);
      const kx = C.x + knot.current.x * SCALE;
      const ky = C.y + knot.current.y * SCALE;
      p.dirs.forEach((d, t) => {
        // win line for this team
        const lx = C.x + d.x * p.win * SCALE;
        const ly = C.y + d.y * p.win * SCALE;
        ctx.strokeStyle = teamColor(t)!;
        ctx.lineWidth = 8;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(lx - d.y * 70, ly + d.x * 70);
        ctx.lineTo(lx + d.y * 70, ly - d.x * 70);
        ctx.stroke();
        ctx.setLineDash([]);
        // rope
        const ex = C.x + d.x * 560;
        const ey = C.y + d.y * 560;
        ctx.strokeStyle = '#a8763e';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // pullers along the rope, leaning back (squeezed so they always stay on screen)
        const members = p.teams[t];
        const edge = Math.min(d.x > 0.01 ? (W - 40 - kx) / d.x : d.x < -0.01 ? (40 - kx) / d.x : 1e9, d.y > 0.01 ? (H - 60 - ky) / d.y : d.y < -0.01 ? (60 - ky) / d.y : 1e9);
        const gap = Math.max(26, Math.min(62, (edge - 80) / Math.max(1, members.length)));
        members.forEach((id, i) => {
          const dist = 80 + i * gap;
          const bx = kx + d.x * dist;
          const by = ky + d.y * dist + 10;
          const m = player(id);
          drawBloop(ctx, bx, by, 26, m?.avatar, { me: id === me, ring: teamColor(t), mood: p.phase === 'pull' ? 'shock' : undefined, flip: d.x > 0 });
        });
      });
      // knot
      ctx.fillStyle = '#ff4f5f';
      ctx.beginPath();
      ctx.arc(kx, ky, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.stroke();
      if (p.phase === 'count') text(ctx, `${Math.max(1, Math.ceil((p.phaseEnds - now) / 1000))}`, W / 2, 120, 90, '#fff');
      if (p.phase === 'result' && p.roundWinner != null) text(ctx, `Team ${teamName(p.roundWinner)} wins the pull!`, W / 2, 110, 54, teamColor(p.roundWinner));
      // beat pulse on the button
      if (beatRef.current && p.phase === 'pull') {
        const ph = (((now - p.beat0) % p.beat) + p.beat) % p.beat;
        const k = Math.max(0, 1 - ph / 200);
        beatRef.current.style.boxShadow = `inset 0 0 0 ${Math.round(k * 14)}px rgba(255,255,255,${0.15 + k * 0.6})`;
        const beatIdx = Math.floor((now - p.beat0) / p.beat);
        if (beatIdx !== lastBeat) {
          lastBeat = beatIdx;
          sfx('tick', 0.8);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.wins} me={me} players={players} fmt={(v) => `${v} 🏆`} />
      <div className="arena-wrap" style={{ flex: 1, minHeight: 180 }}>
        <canvas ref={ref} className="arena-canvas" />
      </div>
      {isPlayer && (
        <button className="tug-btn" style={{ background: teamColor(mine) ?? 'var(--pink)' }} onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={!pulling}>
          <div ref={beatRef} className="tug-beat" />
          {pulling ? 'PULL!' : pub.phase === 'count' ? 'Get ready…' : '…'}
        </button>
      )}
      <div className="small">Round {pub.round + 1}/{pub.rounds} · tap on the beat for a power pull!</div>
    </div>
  );
}
