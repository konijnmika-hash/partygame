import './arcade.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { gflipDef, GF, type GFState, type GFWorld } from '@shared/ghosts/arcade';
import { drawBloop, text } from '../../game/canvas';
import { isTouchDevice } from '../../game/input';
import { usePortrait } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';
import type { Avatar } from '@shared/types';

const H = 600;
const SPIKE = 34;

function bloopG(ctx: CanvasRenderingContext2D, x: number, y: number, g: number, avatar: Avatar | undefined, o: { me?: boolean; alpha?: number; mood?: 'shock' | 'happy' }) {
  ctx.save();
  ctx.translate(x, y);
  if (g < 0) ctx.scale(1, -1);
  drawBloop(ctx, 0, 0, GF.R, avatar, o);
  ctx.restore();
}

export default function GravityFlip({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const portrait = usePortrait();
  const VW = portrait ? 600 : 1000;
  const last = useRef({ flips: 0, crashes: 0 });
  const touch = isTouchDevice();
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<GFWorld, GFState>
        def={gflipDef}
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
          let my = GF.FLOOR - GF.R;
          if (s) {
            const p = d.prev ?? s;
            mx = lerp(p.x, s.x, d.alpha);
            my = lerp(p.y, s.y, d.alpha);
          } else if (d.others.length) mx = Math.max(...d.others.map((o) => o.s.x));
          const bg = ctx.createLinearGradient(0, GF.CEIL, 0, GF.FLOOR);
          bg.addColorStop(0, '#2a1260');
          bg.addColorStop(0.5, '#4b1f8f');
          bg.addColorStop(1, '#2a1260');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, VW, H);
          // speed streaks
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 3;
          for (let k = 0; k < 14; k++) {
            const y = GF.CEIL + 30 + ((k * 61) % (GF.FLOOR - GF.CEIL - 60));
            const x = (((k * 173 - mx * 1.6) % (VW + 200)) + VW + 200) % (VW + 200) - 100;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 70, y);
            ctx.stroke();
          }
          // floor & ceiling
          for (const [y0, y1] of [[0, GF.CEIL], [GF.FLOOR, H]]) {
            ctx.fillStyle = '#ff7ac8';
            ctx.fillRect(0, y0, VW, y1 - y0);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            for (let x = -((mx % 80) + 80); x < VW + 80; x += 80) ctx.fillRect(x, y0 === 0 ? y1 - 10 : y0, 40, 10);
          }
          // spikes
          ctx.fillStyle = '#ffe066';
          ctx.strokeStyle = '#a65f00';
          ctx.lineWidth = 2;
          for (const sp of w.spikes) {
            const sx = sp.x - mx + GF.X;
            if (sx > VW + 10) break;
            if (sx + sp.w < -10) continue;
            const n = Math.max(1, Math.round(sp.w / 24));
            const tw = sp.w / n;
            for (let k = 0; k < n; k++) {
              ctx.beginPath();
              if (sp.top) {
                ctx.moveTo(sx + k * tw, GF.CEIL);
                ctx.lineTo(sx + k * tw + tw / 2, GF.CEIL + SPIKE);
                ctx.lineTo(sx + (k + 1) * tw, GF.CEIL);
              } else {
                ctx.moveTo(sx + k * tw, GF.FLOOR);
                ctx.lineTo(sx + k * tw + tw / 2, GF.FLOOR - SPIKE);
                ctx.lineTo(sx + (k + 1) * tw, GF.FLOOR);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          }
          for (const o of d.others) {
            if (o.s.o) continue;
            const gx = o.s.x - mx + GF.X;
            if (gx < -40 || gx > VW + 40) continue;
            bloopG(ctx, gx, o.s.y, o.s.g, player(o.id)?.avatar, { alpha: 0.35 });
          }
          if (s) {
            const blink = s.inv > 0 && Math.floor(performance.now() / 90) % 2 === 0;
            bloopG(ctx, GF.X, my, s.g, player(me)?.avatar, { me: true, mood: s.stun ? 'shock' : 'happy', alpha: s.stun || blink ? 0.45 : 1 });
            if (s.stun) text(ctx, '💥', GF.X, my, 52);
            if (s.flips > last.current.flips) sfx('whoosh', 1.2);
            if (s.crashes > last.current.crashes) {
              sfx('hit');
              vibrate([140, 60, 140]);
            }
            last.current = { flips: s.flips, crashes: s.crashes };
            text(ctx, `${Math.round(s.x / 50)} m`, VW / 2, 66, 48, '#fff');
            if (s.stun) text(ctx, 'Spiked! 💫', VW / 2, H / 2, 56, '#ffe066');
          }
          const left = Math.max(0, Math.ceil((gflipDef.maxTicks - d.tick) / GF.HZ));
          text(ctx, `⏱ ${left}s`, VW - 16, 30, 24, left <= 10 ? '#ff8a8f' : '#fff', 'right');
          if (!d.started) text(ctx, touch ? 'Tap to flip gravity!' : 'Space / ↑↓ to flip gravity!', VW / 2, H / 2, 44, '#fff');
        }}
      />
    </div>
  );
}
