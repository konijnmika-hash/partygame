import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  holder: string | null;
  crown: { x: number; y: number };
  p: { id: string; x: number; y: number; d: number }[];
  scores: Record<string, number>;
}

export default function CrownChase({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; from?: string; by?: string };
    if (ev.type === 'grab') sfx(d.id === me ? 'coin' : 'ding', 1.2);
    if (ev.type === 'knock') {
      sfx('hit');
      if (d.from === me) vibrate(120);
    }
  }, false), [me]);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 700 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#7a1f4a';
          roundRect(ctx, 0, 0, 1000, 700, 24);
          ctx.fill();
          ctx.fillStyle = '#a8326a';
          roundRect(ctx, 60, 60, 880, 580, 18);
          ctx.fill();
          ctx.strokeStyle = '#ffd23f';
          ctx.lineWidth = 6;
          ctx.setLineDash([18, 12]);
          roundRect(ctx, 80, 80, 840, 540, 14);
          ctx.stroke();
          ctx.setLineDash([]);
          for (const p of s.p) {
            const m = player(p.id);
            if (p.d) {
              ctx.fillStyle = 'rgba(255,255,255,0.35)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me, mood: s.holder === p.id ? 'happy' : undefined });
          }
          const c = s.holder ? s.p.find((p) => p.id === s.holder) : null;
          const cx = c ? c.x : s.crown.x;
          const cy = c ? c.y - 42 : s.crown.y;
          if (!c) {
            ctx.fillStyle = 'rgba(255,210,63,0.25)';
            ctx.beginPath();
            ctx.arc(cx, cy, 34 + Math.sin(d.t / 150) * 5, 0, Math.PI * 2);
            ctx.fill();
          }
          emoji(ctx, '👑', cx, cy, 40, Math.sin(d.t / 200) * 0.15);
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} fmt={(v) => `${v.toFixed(1)}s`} title="Crown time" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v.toFixed(1)}s`} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          <span className="ph-pill gold">👑 {pub.holder ? (pub.holder === me ? 'YOU!' : nm(players, pub.holder)) : 'up for grabs'}</span>
        </div>
      </div>
      {isPlayer && <TouchControls a="DASH" />}
    </div>
  );
}
