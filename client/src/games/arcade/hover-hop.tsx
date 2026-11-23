import './arcade.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { hoverDef, HH, type HHState, type HHWorld } from '@shared/ghosts/arcade';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { isTouchDevice } from '../../game/input';
import { usePortrait } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

const H = HH.H;

function pillar(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, cap: 'top' | 'bottom') {
  if (y1 <= y0) return;
  const g = ctx.createLinearGradient(x, 0, x + HH.PW, 0);
  g.addColorStop(0, '#2fb86a');
  g.addColorStop(0.5, '#5be38f');
  g.addColorStop(1, '#23955a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y0, HH.PW, y1 - y0);
  ctx.fillStyle = '#1b7a48';
  const cy = cap === 'top' ? y1 - 26 : y0;
  roundRect(ctx, x - 7, cy, HH.PW + 14, 26, 8);
  ctx.fill();
  ctx.strokeStyle = '#11502f';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export default function HoverHop({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const portrait = usePortrait();
  const VW = portrait ? 600 : 1000;
  const last = useRef({ flaps: 0, passed: 0, crashes: 0 });
  const touch = isTouchDevice();
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<HHWorld, HHState>
        def={hoverDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA
        worldSize={() => ({ w: VW, h: H })}
        draw={(ctx, d) => {
          const w = d.world;
          const s = d.me;
          let mx = 0;
          let my = H / 2;
          if (s) {
            const p = d.prev ?? s;
            mx = lerp(p.x, s.x, d.alpha);
            my = lerp(p.y, s.y, d.alpha);
          } else if (d.others.length) mx = Math.max(...d.others.map((o) => o.s.x));
          const sky = ctx.createLinearGradient(0, 0, 0, H);
          sky.addColorStop(0, '#6ec8ff');
          sky.addColorStop(1, '#d7f1ff');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, VW, H);
          // parallax clouds and hills
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          for (let k = 0; k < 6; k++) {
            const cx = ((k * 260 - mx * 0.2) % (VW + 300) + VW + 300) % (VW + 300) - 150;
            const cy = 70 + (k * 53) % 160;
            ctx.beginPath();
            ctx.arc(cx, cy, 30, 0, Math.PI * 2);
            ctx.arc(cx + 30, cy - 12, 36, 0, Math.PI * 2);
            ctx.arc(cx + 64, cy, 28, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#9bd88a';
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, H - 70 - Math.sin((x + mx * 0.4) / 140) * 30);
          ctx.lineTo(VW, H);
          ctx.fill();
          // pillars
          for (const p of w.pillars) {
            const sx = p.x - mx + HH.X - HH.PW / 2;
            if (sx > VW + 20) break;
            if (sx < -HH.PW - 20) continue;
            pillar(ctx, sx, 0, p.gy - p.gap / 2, 'top');
            pillar(ctx, sx, p.gy + p.gap / 2, H, 'bottom');
          }
          // spiky ground
          ctx.fillStyle = '#5d4aa8';
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = -((mx % 24) + 24); x < VW + 24; x += 24) {
            ctx.lineTo(x, H - 4);
            ctx.lineTo(x + 12, H - 18);
          }
          ctx.lineTo(VW, H);
          ctx.fill();
          for (const o of d.others) {
            if (o.s.o) continue;
            const gx = o.s.x - mx + HH.X;
            if (gx < -40 || gx > VW + 40) continue;
            drawBloop(ctx, gx, o.s.y, 15, player(o.id)?.avatar, { alpha: 0.35 });
          }
          if (s) {
            const tiltSq = Math.max(0.8, Math.min(1.2, 1 - (s.vy ?? 0) / 2400));
            drawBloop(ctx, HH.X, my, HH.R + 2, player(me)?.avatar, { me: true, squash: tiltSq, mood: s.stun ? 'shock' : s.vy < 0 ? 'happy' : 'normal', alpha: s.stun ? 0.7 : 1 });
            if (s.stun) text(ctx, '💫', HH.X + 6, my - 34, 30);
            if (s.flaps > last.current.flaps) sfx('jump', 1.3);
            if (s.passed > last.current.passed) sfx('coin');
            if (s.crashes > last.current.crashes) {
              sfx('hit');
              vibrate([120, 50, 120]);
            }
            last.current = { flaps: s.flaps, passed: s.passed, crashes: s.crashes };
            text(ctx, String(s.passed), VW / 2, 60, 64, '#fff');
            if (s.stun) text(ctx, 'Bonk! Get ready…', VW / 2, H / 2 - 40, 46, '#ff5a5f');
            else if (s.hover > 0 && d.started) text(ctx, touch ? 'Tap!' : 'Flap!', HH.X, my - 50, 28, '#fff');
          }
          const left = Math.max(0, Math.ceil((hoverDef.maxTicks - d.tick) / HH.HZ));
          text(ctx, `⏱ ${left}s`, VW - 16, 30, 24, left <= 10 ? '#ff5a5f' : '#fff', 'right');
          if (!d.started) text(ctx, touch ? 'Tap to flap!' : 'Space / ↑ to flap!', VW / 2, H / 2 - 90, 48, '#fff');
        }}
      />
    </div>
  );
}
