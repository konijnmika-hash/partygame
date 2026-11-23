import './racing.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { platformerDef, tileAt, PF_HZ, PF_T, PF_ROWS, PF_PH, type PFState, type PFWorld } from '@shared/ghosts/platformer';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { usePortrait } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

const VW_WIDE = 1000;
const VW_TALL = 560;
const VH = PF_ROWS * PF_T;

function drawTiles(ctx: CanvasRenderingContext2D, w: PFWorld, camX: number, VW: number) {
  const c0 = Math.max(0, Math.floor(camX / PF_T) - 1);
  const c1 = Math.min(w.cols - 1, Math.ceil((camX + VW) / PF_T) + 1);
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < PF_ROWS; r++) {
      const t = tileAt(w, c, r);
      const x = c * PF_T;
      const y = r * PF_T;
      if (t === 1) {
        const topOpen = tileAt(w, c, r - 1) !== 1;
        ctx.fillStyle = '#a0673a';
        ctx.fillRect(x, y, PF_T, PF_T);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 6, y + 14, 8, 6);
        ctx.fillRect(x + 24, y + 26, 8, 6);
        if (topOpen) {
          ctx.fillStyle = '#4ccf5e';
          ctx.fillRect(x, y, PF_T, 12);
          ctx.fillStyle = '#3aa94b';
          ctx.fillRect(x, y + 10, PF_T, 4);
        }
      } else if (t === 2) {
        ctx.fillStyle = '#c9c4e6';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x + k * 13.3, y + PF_T);
          ctx.lineTo(x + k * 13.3 + 6.6, y + 12);
          ctx.lineTo(x + (k + 1) * 13.3, y + PF_T);
          ctx.closePath();
          ctx.fill();
        }
      } else if (t === 3 || t === 4) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 18, y - 40, 4, 80);
        ctx.fillStyle = t === 4 ? '#ffd23f' : '#3da9fc';
        ctx.beginPath();
        ctx.moveTo(x + 22, y - 40);
        ctx.lineTo(x + 50, y - 28);
        ctx.lineTo(x + 22, y - 16);
        ctx.closePath();
        ctx.fill();
        if (t === 4) text(ctx, 'GOAL', x + 20, y - 58, 24, '#ffd23f');
      }
    }
  }
}

export default function SpeedRun({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const VW = usePortrait() ? VW_TALL : VW_WIDE;
  const camX = useRef(0);
  const lastDeaths = useRef(0);
  const lastCp = useRef(-1);
  const wasGround = useRef(1);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<PFWorld, PFState>
        def={platformerDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA={false}
        worldSize={() => ({ w: VW, h: VH })}
        draw={(ctx, d) => {
          const w = d.world;
          const s = d.me;
          let fx = w.startX;
          let fy = w.startY;
          if (s) {
            const p = d.prev ?? s;
            fx = Math.abs(s.x - p.x) > 200 ? s.x : lerp(p.x, s.x, d.alpha);
            fy = Math.abs(s.y - p.y) > 200 ? s.y : lerp(p.y, s.y, d.alpha);
          } else if (d.others.length) {
            const lead = d.others.reduce((a, b) => (b.s.x > a.s.x ? b : a));
            fx = lead.s.x;
          }
          const want = Math.max(0, Math.min(w.cols * PF_T - VW, fx - VW * 0.38));
          camX.current += (want - camX.current) * Math.min(1, d.dt * 10);
          const cx = camX.current;
          const sky = ctx.createLinearGradient(0, 0, 0, VH);
          sky.addColorStop(0, '#7fd3ff');
          sky.addColorStop(1, '#d9f4ff');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, VW, VH);
          // parallax clouds
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          for (let i = 0; i < 6; i++) {
            const x = ((i * 260 - cx * 0.3) % (VW + 300) + VW + 300) % (VW + 300) - 150;
            ctx.beginPath();
            ctx.ellipse(x, 60 + (i % 3) * 40, 60, 22, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.save();
          ctx.translate(-cx, 0);
          drawTiles(ctx, w, cx, VW);
          for (const o of d.others) {
            if (o.s.d) continue;
            drawBloop(ctx, o.s.x, o.s.y - PF_PH / 2, 17, player(o.id)?.avatar, { alpha: 0.35, flip: o.s.fc < 0 });
          }
          if (s) {
            if (s.dead) {
              text(ctx, '💥', fx, fy - 20, 44);
            } else drawBloop(ctx, fx, fy - PF_PH / 2, 19, player(me)?.avatar, { me: true, flip: s.face < 0, squash: s.ground ? 1 : 0.9, mood: s.vy < -200 ? 'happy' : undefined });
            if (s.deaths > lastDeaths.current) {
              sfx('hit');
              vibrate(120);
            }
            if (s.cp > lastCp.current && lastCp.current >= -1 && s.cp >= 0) sfx('ding');
            if (!wasGround.current && s.ground && s.vy === 0) sfx('tap', 0.7);
            if (wasGround.current && !s.ground && s.vy < 0) sfx('jump');
            lastDeaths.current = s.deaths;
            lastCp.current = s.cp;
            wasGround.current = s.ground;
          }
          ctx.restore();
          // HUD
          if (s) {
            const secs = (s.finished || d.tick) / PF_HZ;
            text(ctx, `${secs.toFixed(1)}s`, 20, 30, 28, '#1d1442', 'left');
            text(ctx, `💀 ${s.deaths}`, 20, 64, 22, '#1d1442', 'left');
            ctx.fillStyle = 'rgba(20,8,50,0.35)';
            roundRect(ctx, 200, 18, VW - 400, 12, 6);
            ctx.fill();
            for (const o of d.others) {
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(200 + Math.min(1, o.s.x / w.goalX) * (VW - 400), 24, 6, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.arc(200 + Math.min(1, s.x / w.goalX) * (VW - 400), 24, 9, 0, Math.PI * 2);
            ctx.fill();
            if (s.finished) text(ctx, `Finished in ${(s.finished / PF_HZ).toFixed(2)}s!`, VW / 2, VH / 2 - 60, 46, '#ffd23f');
          }
          if (!d.started) text(ctx, 'Get set...', VW / 2, VH / 2 - 60, 54, '#1d1442');
        }}
      />
      {isPlayer && <TouchControls a="JUMP" />}
    </div>
  );
}
