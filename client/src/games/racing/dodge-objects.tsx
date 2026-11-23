import './racing.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text, emoji } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const W = 1000;
const H = 700;
const METEOR_R = 72;
const GAP = 130;

interface Laser { id: number; v: boolean; from: number; to: number; start: number; dur: number; g: number }
interface Pub {
  t0: number;
  endsAt: number;
  p: { id: string; x: number; y: number; l: number; sh: number; o: number }[];
  m: { id: number; x: number; y: number; k: number }[];
  l: Laser[];
  fx: { k: 'boom' | 'hit'; x: number; y: number; at: number }[];
  left: number;
}

function drawBeam(ctx: CanvasRenderingContext2D, l: Laser, pos: number, warn: boolean) {
  ctx.save();
  if (warn) {
    ctx.setLineDash([16, 14]);
    ctx.strokeStyle = 'rgba(255,79,95,0.7)';
    ctx.lineWidth = 4;
  } else {
    ctx.shadowColor = '#ff4f5f';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#ff6b7a';
    ctx.lineWidth = 16;
  }
  const span = l.v ? H : W;
  const g0 = l.g - GAP / 2;
  const g1 = l.g + GAP / 2;
  ctx.beginPath();
  if (l.v) {
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, g0);
    ctx.moveTo(pos, g1);
    ctx.lineTo(pos, span);
  } else {
    ctx.moveTo(0, pos);
    ctx.lineTo(g0, pos);
    ctx.moveTo(g1, pos);
    ctx.lineTo(span, pos);
  }
  ctx.stroke();
  ctx.restore();
}

export default function DodgeObjects({ pub, pubT, me, isPlayer, input, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string; lives: number };
    if (ev.type === 'hit') {
      sfx(d.id === me ? 'hit' : 'pop');
      if (d.id === me) vibrate([120, 50, 120]);
    }
  }, false), [me]);
  const meP = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const latest = d.latest as Pub;
          ctx.fillStyle = '#2a1f5e';
          roundRect(ctx, 0, 0, W, H, 26);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 2;
          for (let x = 50; x < W; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
          }
          for (let y = 50; y < H; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          }
          // meteor shadows
          for (const m of latest.m) {
            ctx.fillStyle = `rgba(0,0,0,${0.2 + m.k * 0.35})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, METEOR_R * (0.4 + m.k * 0.6), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,90,95,0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(m.x, m.y, METEOR_R, 0, Math.PI * 2);
            ctx.stroke();
            if (m.k > 0.55) emoji(ctx, '☄️', m.x + (1 - m.k) * 260, m.y - (1 - m.k) * 520, 60 + m.k * 20, -0.5);
          }
          for (const l of latest.l) {
            const k = (d.t - l.start) / l.dur;
            if (k < 0) drawBeam(ctx, l, l.from < 0 ? 6 : (l.v ? W : H) - 6, true);
            else if (k <= 1) drawBeam(ctx, l, l.from + (l.to - l.from) * k, false);
          }
          for (const f of latest.fx) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            if (f.k === 'boom') {
              ctx.fillStyle = `rgba(255,170,60,${0.7 * (1 - age)})`;
              ctx.beginPath();
              ctx.arc(f.x, f.y, METEOR_R * (0.8 + age * 0.5), 0, Math.PI * 2);
              ctx.fill();
            } else text(ctx, '💥', f.x, f.y - 30 - age * 20, 40);
          }
          for (const p of s.p) {
            if (p.o) continue;
            const m = player(p.id);
            const blink = p.sh && Math.floor(d.t / 90) % 2 === 0;
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me, alpha: blink ? 0.4 : 1, mood: p.sh ? 'shock' : undefined });
            text(ctx, '❤️'.repeat(Math.max(0, p.l)), p.x, p.y + 42, 16);
          }
          if (d.t < s.t0) text(ctx, 'Dodge everything!', W / 2, H / 2 - 40, 56, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">🧍 {pub.left} left</span>
        {meP && <span className="ph-pill gold">{meP.o ? 'Out! 😵' : '❤️'.repeat(Math.max(0, meP.l))}</span>}
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
