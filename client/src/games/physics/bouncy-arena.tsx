import './physics.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

const S = 1000;
const C = 500;

interface Pub {
  round: number;
  rounds: number;
  phase: 'countdown' | 'play' | 'break' | 'over';
  R: number;
  phaseEnds: number;
  p: { id: string; x: number; y: number; o: number; oa: number; d: number; cd: number }[];
  fx: { k: 'ko' | 'bump'; x: number; y: number; at: number }[];
  scores: Record<string, number>;
  winner: string | null;
}

export default function BouncyArena({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'ko') {
      const d = ev.data as { id: string; by: string | null };
      sfx('splash');
      if (d.id === me) vibrate([120, 60, 120]);
      if (d.by === me) sfx('cheer');
    }
    if (ev.type === 'round') sfx('win');
  }, false), [me]);
  useEffect(() => {
    if (pub.phase === 'play') sfx('go');
  }, [pub.phase, pub.round]);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: S, h: S }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          // water
          const wg = ctx.createRadialGradient(C, C, 100, C, C, 760);
          wg.addColorStop(0, '#3fb6ff');
          wg.addColorStop(1, '#1e5fd0');
          ctx.fillStyle = wg;
          ctx.fillRect(0, 0, S, S);
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 4;
          for (let i = 0; i < 6; i++) {
            const rr = ((d.t / 22 + i * 90) % 540) + 200;
            ctx.beginPath();
            ctx.arc(C, C, rr, 0, Math.PI * 2);
            ctx.stroke();
          }
          // platform
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.arc(C + 8, C + 18, s.R, 0, Math.PI * 2);
          ctx.fill();
          const pg = ctx.createRadialGradient(C - s.R * 0.3, C - s.R * 0.3, 20, C, C, s.R);
          pg.addColorStop(0, '#fff5d6');
          pg.addColorStop(1, '#ffc96b');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(C, C, s.R, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 14;
          ctx.strokeStyle = '#ff7a59';
          ctx.setLineDash([30, 22]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,122,89,0.25)';
          ctx.beginPath();
          ctx.arc(C, C, 60, 0, Math.PI * 2);
          ctx.fill();
          for (const f of d.latest.fx as Pub['fx']) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            if (f.k === 'bump') text(ctx, '💥', f.x, f.y, 40 + age * 20);
            else {
              ctx.strokeStyle = `rgba(255,255,255,${1 - age})`;
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.arc(f.x, f.y, 20 + age * 70, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.o) {
              // sink into the water
              const age = (d.t - p.oa) / 900;
              if (age > 1) continue;
              drawBloop(ctx, p.x, p.y, 30 * (1 - age * 0.7), m?.avatar, { alpha: 1 - age, mood: 'shock' });
              continue;
            }
            if (p.d) {
              ctx.fillStyle = 'rgba(255,255,255,0.45)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 40, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 30, m?.avatar, { name: m?.name, me: p.id === me, mood: p.d ? 'happy' : undefined });
            if (p.id === me && p.cd > 0) {
              ctx.strokeStyle = '#ffd23f';
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(p.x, p.y + 4, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.cd / 1300));
              ctx.stroke();
            }
          }
          if (s.phase === 'countdown') {
            const secs = Math.max(1, Math.ceil((s.phaseEnds - d.t) / 1000));
            text(ctx, `Round ${s.round + 1}/${s.rounds}`, C, 160, 64, '#fff');
            text(ctx, `${secs}`, C, 260, 90, '#ffd23f');
          } else if (s.phase === 'break') {
            text(ctx, s.winner ? `${s.winner === me ? 'You win' : `${nm(players, s.winner)} wins`} the round!` : 'Draw!', C, 160, 54, '#ffd23f');
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <span className="ph-pill">Round {pub.round + 1}/{pub.rounds}</span>
      </div>
      {isPlayer && <TouchControls a="DASH" />}
    </div>
  );
}
