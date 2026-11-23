import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  p: { id: string; x: number; y: number; n: number; fz: number; ax: number; ay: number }[];
  o: { id: number; x: number; y: number }[];
  piles: { x: number; y: number; n: number }[];
  fx: { x: number; y: number; at: number }[];
  scores: Record<string, number>;
}

export default function SnowballFight({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string; by: string };
    if (ev.type === 'splat') {
      sfx(d.by === me ? 'coin' : 'splash', d.by === me ? 1.2 : 1);
      if (d.id === me) vibrate(120);
    }
  }, false), [me]);
  const mine = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 700 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const g = ctx.createLinearGradient(0, 0, 0, 700);
          g.addColorStop(0, '#eaf6ff');
          g.addColorStop(1, '#cfe8ff');
          ctx.fillStyle = g;
          roundRect(ctx, 0, 0, 1000, 700, 24);
          ctx.fill();
          for (const pile of (d.latest as Pub).piles) {
            ctx.fillStyle = pile.n ? '#ffffff' : 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.ellipse(pile.x, pile.y, 40, 24, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a9cbe8';
            ctx.lineWidth = 3;
            ctx.stroke();
            if (pile.n) text(ctx, `❄️${pile.n}`, pile.x, pile.y, 18, '#3d7fc4');
          }
          for (const b of s.o) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#9cc0e0';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.id === me) {
              ctx.strokeStyle = 'rgba(61,127,196,0.6)';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(p.x + p.ax * 34, p.y + p.ay * 34);
              ctx.lineTo(p.x + p.ax * 70, p.y + p.ay * 70);
              ctx.stroke();
            }
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me, alpha: p.fz ? 0.7 : 1, mood: p.fz ? 'shock' : undefined, ring: p.fz ? '#7cd4ff' : undefined });
            if (p.fz) text(ctx, '🧊', p.x, p.y - 52, 26);
            for (let k = 0; k < p.n; k++) {
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(p.x - 14 + k * 14, p.y + 40, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 600;
            if (age >= 0 && age <= 1) text(ctx, 'SPLAT!', f.x, f.y - 30 - age * 30, 28, '#3d7fc4');
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Hits" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v} hits`} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          {mine && <span className="ph-pill">{mine.n ? '⚪'.repeat(mine.n) : 'grab snow!'}</span>}
        </div>
      </div>
      {isPlayer && <TouchControls a="THROW" />}
    </div>
  );
}
