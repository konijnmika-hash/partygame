import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { colorOf } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  p: { id: string; x: number; y: number; a: number; al: number; inv: number }[];
  o: { id: number; x: number; y: number; b: number }[];
  mines: { id: number; x: number; y: number; ar: number; ow: string }[];
  fx: { x: number; y: number; at: number; k: string }[];
  scores: Record<string, number>;
}

const BLOCKS: [number, number, number, number][] = [
  [455, 290, 90, 120],
  [190, 140, 160, 36],
  [650, 140, 160, 36],
  [190, 524, 160, 36],
  [650, 524, 160, 36],
  [110, 300, 36, 100],
  [854, 300, 36, 100],
  [300, 320, 36, 60],
  [664, 320, 36, 60],
];

function tank(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(a);
  // treads
  ctx.fillStyle = '#2c2c3c';
  roundRect(ctx, -26, -26, 52, 12, 4);
  ctx.fill();
  roundRect(ctx, -26, 14, 52, 12, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -22, -16, 44, 32, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // barrel
  ctx.fillStyle = '#3a3a4c';
  roundRect(ctx, 4, -5, 30, 10, 3);
  ctx.fill();
  ctx.restore();
}

export default function RicochetTanks({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; by?: string };
    if (ev.type === 'shot' && d.id === me) sfx('pop', 0.7);
    if (ev.type === 'bounce') sfx('tick');
    if (ev.type === 'boom') sfx('boom', 1.1);
    if (ev.type === 'mine' && d.id === me) sfx('tock');
    if (ev.type === 'destroyed') {
      sfx('boom');
      if (d.id === me) vibrate(260);
      if (d.by === me && d.id !== me) sfx('win', 1.3);
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
          const L = d.latest as Pub;
          ctx.fillStyle = '#e8d6ae';
          ctx.fillRect(0, 0, 1000, 700);
          ctx.strokeStyle = 'rgba(160,120,70,0.18)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= 1000; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 700);
            ctx.stroke();
          }
          for (let y = 0; y <= 700; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1000, y);
            ctx.stroke();
          }
          for (const [x, y, w, h] of BLOCKS) {
            ctx.fillStyle = '#9a6b3c';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#b8864f';
            ctx.fillRect(x + 4, y + 4, w - 8, h - 12);
          }
          ctx.strokeStyle = '#7a5028';
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, 990, 690);
          for (const m of L.mines) {
            ctx.fillStyle = m.ar && Math.floor(d.t / 250) % 2 ? '#ff4f5f' : '#ffd23f';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colorOf(players, m.ow);
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          for (const p of s.p) {
            if (!p.al) continue;
            const m = player(p.id);
            const blink = p.inv && Math.floor(d.t / 90) % 2 === 0;
            tank(ctx, p.x, p.y, p.a, colorOf(players, p.id), blink ? 0.4 : 1);
            drawBloop(ctx, p.x, p.y - 4, 13, m?.avatar, { name: m?.name, me: p.id === me, alpha: blink ? 0.4 : 1 });
          }
          for (const b of s.o) {
            ctx.fillStyle = b.b ? '#ff7a3d' : '#2b2b3c';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            if (f.k === 'c') {
              ctx.strokeStyle = `rgba(255,255,255,${1 - age})`;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(f.x, f.y, 6 + age * 18, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              ctx.fillStyle = `rgba(255,140,40,${0.7 * (1 - age)})`;
              ctx.beginPath();
              ctx.arc(f.x, f.y, (f.k === 'm' ? 95 : 40) * (0.4 + age * 0.6), 0, Math.PI * 2);
              ctx.fill();
              emoji(ctx, '💥', f.x, f.y, 40 * (1 + age * 0.4));
            }
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Kills" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v} kills`} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls a="FIRE" b="MINE" />}
    </div>
  );
}
