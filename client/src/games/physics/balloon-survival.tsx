import './physics.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const W = 1000;
const H = 700;
const BALLOON = ['#ff4f5f', '#ffd23f', '#3da9fc'];

interface Pub {
  t0: number;
  endsAt: number;
  p: { id: string; x: number; y: number; n: number; sh: number; d: number; o: number; cd: number }[];
  o: { id: number; x: number; y: number; a: number }[];
  fx: { k: 'pop'; x: number; y: number; at: number; c: number }[];
  left: number;
}

export default function BalloonSurvival({ pub, pubT, me, isPlayer, input, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'pop') {
      const d = ev.data as { id: string; by: string | null };
      sfx('pop', d.id === me ? 0.7 : 1.2);
      if (d.id === me) vibrate(120);
      if (d.by === me) sfx('coin');
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
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, '#ffe9f5');
          g.addColorStop(1, '#ffd0e6');
          ctx.fillStyle = g;
          roundRect(ctx, 0, 0, W, H, 26);
          ctx.fill();
          ctx.strokeStyle = '#ff9cc8';
          ctx.lineWidth = 10;
          roundRect(ctx, 5, 5, W - 10, H - 10, 22);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          for (let i = 0; i < 9; i++) {
            ctx.beginPath();
            ctx.arc(80 + i * 110, 60 + (i % 3) * 230, 40, 0, Math.PI * 2);
            ctx.fill();
          }
          // darts
          for (const o of s.o) {
            ctx.save();
            ctx.translate(o.x, o.y);
            ctx.rotate(o.a);
            ctx.fillStyle = '#4a3d80';
            ctx.fillRect(-26, -3, 40, 6);
            ctx.fillStyle = '#c0c4d6';
            ctx.beginPath();
            ctx.moveTo(26, 0);
            ctx.lineTo(12, -8);
            ctx.lineTo(12, 8);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff4f9a';
            ctx.beginPath();
            ctx.moveTo(-26, 0);
            ctx.lineTo(-36, -10);
            ctx.lineTo(-30, 0);
            ctx.lineTo(-36, 10);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          for (const p of s.p) {
            if (p.o) continue;
            const m = player(p.id);
            const blink = p.sh && Math.floor(d.t / 90) % 2 === 0;
            // balloons on strings
            for (let k = 0; k < p.n; k++) {
              const bx = p.x + (k - (p.n - 1) / 2) * 24 + Math.sin(d.t / 300 + k) * 4;
              const by = p.y - 70 - (k % 2) * 8;
              ctx.strokeStyle = 'rgba(60,40,90,0.6)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - 24);
              ctx.lineTo(bx, by + 18);
              ctx.stroke();
              ctx.fillStyle = BALLOON[k % BALLOON.length];
              ctx.beginPath();
              ctx.ellipse(bx, by, 14, 18, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,0.55)';
              ctx.beginPath();
              ctx.ellipse(bx - 5, by - 6, 4, 6, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            if (p.d) {
              ctx.fillStyle = 'rgba(255,79,154,0.3)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 40, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 28, m?.avatar, { name: m?.name, me: p.id === me, alpha: blink ? 0.45 : 1, mood: p.sh ? 'shock' : undefined });
          }
          for (const f of d.latest.fx as Pub['fx']) {
            const age = (d.t - f.at) / 700;
            if (age < 0 || age > 1) continue;
            text(ctx, 'POP!', f.x, f.y - age * 40, 34 + age * 10, '#ff4f5f');
          }
          if (d.t < s.t0) text(ctx, 'Protect your balloons!', W / 2, H / 2 - 40, 52, '#ff4f9a');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">🎈 {pub.left} still floating</span>
        {meP && <span className="ph-pill gold">{meP.o ? 'Out! 😵' : `${'🎈'.repeat(Math.max(0, meP.n))}`}</span>}
      </div>
      {isPlayer && <TouchControls a="DASH" />}
    </div>
  );
}
