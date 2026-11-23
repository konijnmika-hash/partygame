import './arcade.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, text } from '../../game/canvas';
import { useInputStream, isTouchDevice } from '../../game/input';
import { MiniScores, RankPill, useSwipe } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { colorOf } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

const CELL = 15;
const VEC = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const SWIPE: Record<string, number> = { right: 0, down: 1, left: 2, up: 3 };

interface Rider { id: string; pts: number[]; x: number; y: number; d: number; a: number; i: number }
interface Pub {
  round: number;
  rounds: number;
  phase: 'count' | 'play' | 'break' | 'over';
  phaseEnds: number;
  cols: number;
  rows: number;
  riders: Rider[];
  winner: string | null;
  scores: Record<string, number>;
}

const cx = (c: number) => c * CELL + CELL / 2;

export default function NeonTrails({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const touch = isTouchDevice();
  const mine = pub.riders.find((r) => r.id === me);
  // the heading we last asked for (so two quick taps chain correctly before the server catches up)
  const pending = useRef<{ d: number; at: number } | null>(null);
  const steer = (d: number) => {
    if (!mine?.a) return;
    pending.current = { d, at: performance.now() };
    input({ x: VEC[d].x, y: VEC[d].y, b: 0 });
    vibrate(10);
    sfx('tick', 1.4);
  };
  const turn = (by: 1 | 3) => {
    if (!mine) return;
    const p = pending.current;
    const base = p && performance.now() - p.at < 260 ? p.d : mine.d;
    steer((base + by) % 4);
  };
  const swipe = useSwipe((dir) => {
    const d = SWIPE[dir];
    const base = pending.current && performance.now() - pending.current.at < 260 ? pending.current.d : mine?.d ?? d;
    if (d !== (base + 2) % 4 && d !== base) steer(d);
  }, 22);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; winner?: string | null };
    if (ev.type === 'crash') {
      sfx(d.id === me ? 'boom' : 'hit', d.id === me ? 1 : 0.8);
      if (d.id === me) vibrate([160, 60, 160]);
    }
    if (ev.type === 'round') sfx(d.winner === me ? 'win' : 'pop');
  }, false), [me]);
  const alive = pub.riders.filter((r) => r.a).length;
  return (
    <div className="g-stage full" style={{ position: 'relative', touchAction: 'none' }} {...(isPlayer ? swipe : {})}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        interp={[]}
        world={{ w: pub.cols * CELL, h: pub.rows * CELL }}
        draw={(ctx, dc) => {
          const s = dc.s as Pub;
          const W = s.cols * CELL;
          const H = s.rows * CELL;
          ctx.fillStyle = '#0a0620';
          ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = 'rgba(120,90,255,0.13)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= s.cols; x += 4) {
            ctx.beginPath();
            ctx.moveTo(x * CELL, 0);
            ctx.lineTo(x * CELL, H);
            ctx.stroke();
          }
          for (let y = 0; y <= s.rows; y += 4) {
            ctx.beginPath();
            ctx.moveTo(0, y * CELL);
            ctx.lineTo(W, y * CELL);
            ctx.stroke();
          }
          ctx.strokeStyle = '#a46bff';
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, W - 4, H - 4);
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          for (const r of s.riders) {
            const col = colorOf(players, r.id, r.i - 1);
            ctx.globalAlpha = r.a ? 1 : 0.32;
            ctx.beginPath();
            ctx.moveTo(cx(r.pts[0]), cx(r.pts[1]));
            for (let k = 2; k < r.pts.length; k += 2) ctx.lineTo(cx(r.pts[k]), cx(r.pts[k + 1]));
            ctx.lineTo(cx(r.x), cx(r.y));
            ctx.strokeStyle = col;
            ctx.lineWidth = 11;
            ctx.globalAlpha *= 0.28;
            ctx.stroke();
            ctx.globalAlpha = r.a ? 1 : 0.32;
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          for (const r of s.riders) {
            const hx = cx(r.x);
            const hy = cx(r.y);
            if (!r.a) {
              emoji(ctx, '💥', hx, hy, 26);
              continue;
            }
            const isMe = r.id === me;
            if (isMe && s.phase === 'count') {
              const pulse = 1 + Math.sin(dc.t / 120) * 0.15;
              ctx.strokeStyle = '#ffd23f';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(hx, hy, 26 * pulse, 0, Math.PI * 2);
              ctx.stroke();
              const v = VEC[r.d];
              text(ctx, '➜', hx + v.x * 40, hy + v.y * 40, 26, '#ffd23f');
            }
            drawBloop(ctx, hx, hy, 11, player(r.id)?.avatar, { me: isMe });
            if (isMe) text(ctx, 'YOU', hx, hy - 22, 14, '#ffd23f');
          }
          if (s.phase === 'count') text(ctx, `Round ${s.round + 1}/${s.rounds}`, W / 2, H / 2 - 30, 54, '#fff');
          if (s.phase === 'count') text(ctx, touch ? 'Swipe or tap ◀ ▶ to turn' : 'Arrow keys / WASD to steer', W / 2, H / 2 + 26, 26, '#cbbcff');
          if (s.phase === 'break') text(ctx, s.winner ? `${s.winner === me ? 'You win' : `${nm(players, s.winner)} wins`} the round! +120` : 'Total wipe-out!', W / 2, H / 2, 40, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <span className="ph-pill">Round {pub.round + 1}/{pub.rounds}</span>
          <span className={`ph-pill ${mine?.a ? 'gold' : ''}`}>{mine ? (mine.a ? `⚡ ${alive} riding` : '💥 Crashed') : `⚡ ${alive} riding`}</span>
        </div>
      </div>
      {isPlayer && touch && (
        <div className="turn-pads">
          <button className="turn-pad" aria-label="Turn left" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); turn(3); }}>◀</button>
          <button className="turn-pad" aria-label="Turn right" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); turn(1); }}>▶</button>
        </div>
      )}
    </div>
  );
}
