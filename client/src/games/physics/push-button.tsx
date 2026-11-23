import './physics.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { sfx } from '../../audio/sfx';

const W = 1000;
const H = 700;
const BR = 78;

interface Pub {
  endsAt: number;
  btn: { x: number; y: number };
  next: { x: number; y: number } | null;
  owner: string | null;
  contested: boolean;
  p: { id: string; x: number; y: number; d: number; st: number; cd: number }[];
  scores: Record<string, number>;
  fx: { k: 'shove'; x: number; y: number; at: number }[];
}

export default function PushButton({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const lastShove = useRef(0);
  useEffect(() => {
    if (pub.owner === me) sfx('coin');
  }, [pub.owner === me]);
  useEffect(() => {
    for (const f of pub.fx) {
      if (f.at > lastShove.current) {
        lastShove.current = f.at;
        sfx('hit');
      }
    }
  }, [pub.fx]);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          // floor tiles
          ctx.fillStyle = '#2d2273';
          roundRect(ctx, 0, 0, W, H, 26);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (let x = 0; x < W; x += 100) for (let y = (x / 100) % 2 ? 0 : 100; y < H; y += 200) ctx.fillRect(x, y, 100, 100);
          ctx.lineWidth = 10;
          ctx.strokeStyle = '#6b55c9';
          roundRect(ctx, 5, 5, W - 10, H - 10, 22);
          ctx.stroke();
          // where the button goes next
          if (s.next) {
            ctx.setLineDash([14, 10]);
            ctx.lineWidth = 6;
            ctx.strokeStyle = `rgba(255,210,63,${0.5 + Math.sin(d.t / 90) * 0.4})`;
            ctx.beginPath();
            ctx.arc(s.next.x, s.next.y, BR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            text(ctx, '!', s.next.x, s.next.y, 60, '#ffd23f');
          }
          // the button
          const b = s.btn;
          const owner = s.owner ? player(s.owner) : null;
          ctx.fillStyle = '#7a1022';
          ctx.beginPath();
          ctx.ellipse(b.x, b.y + 14, BR, BR * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          const g = ctx.createRadialGradient(b.x - 20, b.y - 26, 8, b.x, b.y, BR);
          g.addColorStop(0, s.contested ? '#ffe08a' : '#ff9aa6');
          g.addColorStop(1, s.contested ? '#ffb21f' : '#e8304a');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, BR, BR * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          if (owner) {
            ctx.lineWidth = 8;
            ctx.strokeStyle = s.owner === me ? '#ffd23f' : '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, BR + 10 + Math.sin(d.t / 80) * 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (s.contested) text(ctx, 'CONTESTED!', b.x, b.y - BR - 28, 30, '#ffd23f');
          for (const p of s.p) {
            const m = player(p.id);
            if (p.d) {
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 28, m?.avatar, { name: m?.name, me: p.id === me, mood: p.st ? 'shock' : s.owner === p.id ? 'happy' : undefined });
            if (p.st) text(ctx, '💫', p.x, p.y - 52, 28);
          }
          if (owner) text(ctx, `${owner.name} is charging!`, W / 2, H - 30, 28, s.owner === me ? '#ffd23f' : '#fff');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls a="SHOVE" />}
    </div>
  );
}
