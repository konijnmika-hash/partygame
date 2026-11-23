import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { colorOf } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

const W = 1200;
const H = 800;
const SIZES = [0, 18, 32, 50];

interface Pub {
  endsAt: number;
  p: { id: string; x: number; y: number; a: number; st: number }[];
  o: { id: number; x: number; y: number; s: number; a: number }[];
  shots: [number, number][];
  fx: { x: number; y: number; at: number; s: number }[];
  scores: Record<string, number>;
}

function rockPath(ctx: CanvasRenderingContext2D, id: number, r: number) {
  ctx.beginPath();
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const j = 0.78 + (((id * 7919 + k * 104729) % 100) / 100) * 0.3;
    const x = Math.cos(a) * r * j;
    const y = Math.sin(a) * r * j;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

export default function SpaceBlaster({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string };
    if (ev.type === 'crash' && d.id === me) {
      sfx('boom');
      vibrate([120, 50, 120]);
    }
  }, false), [me]);
  let lastFx = 0;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#0b0726';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          for (let i = 0; i < 70; i++) ctx.fillRect((i * 337) % W, (i * 211) % H, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
          for (const r of s.o) {
            ctx.save();
            ctx.translate(r.x, r.y);
            ctx.rotate(r.a);
            rockPath(ctx, r.id, SIZES[r.s]);
            ctx.fillStyle = '#8a7a9e';
            ctx.fill();
            ctx.strokeStyle = '#d6ccff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = '#ffe066';
          for (const [x, y] of (d.latest as Pub).shots) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          s.p.forEach((p, k) => {
            const m = player(p.id);
            const blink = p.st && Math.floor(d.t / 100) % 2 === 0;
            ctx.save();
            ctx.globalAlpha = blink ? 0.35 : 1;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.a);
            ctx.fillStyle = colorOf(players, p.id, k);
            ctx.beginPath();
            ctx.moveTo(30, 0);
            ctx.lineTo(-18, -20);
            ctx.lineTo(-10, 0);
            ctx.lineTo(-18, 20);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
            drawBloop(ctx, p.x, p.y, 11, m?.avatar, { name: m?.name, me: p.id === me, alpha: blink ? 0.35 : 1 });
          });
          for (const f of (d.latest as Pub).fx) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            if (f.at > lastFx) {
              lastFx = f.at;
              sfx('pop', 0.6 + f.s * 0.15);
            }
            ctx.strokeStyle = `rgba(255,200,80,${1 - age})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(f.x, f.y, SIZES[f.s] * (0.6 + age), 0, Math.PI * 2);
            ctx.stroke();
          }
          const meS = s.p.find((p) => p.id === me);
          if (meS?.st) text(ctx, 'CRASH! 💫', W / 2, 80, 44, '#ff8a8f');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
