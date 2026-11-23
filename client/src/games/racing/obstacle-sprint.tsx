import './racing.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { sprintDef, SP_SHAPES, type SPState, type SPWorld } from '@shared/ghosts/sprint';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { usePortrait, useSwipe } from '../../game/kit';
import { virtual } from '../../game/input';
import { sfx, vibrate } from '../../audio/sfx';

const VW_WIDE = 1000;
const VW_TALL = 600;
const VH = 500;
const GROUND = 400;

function pulse(which: 'a' | 'b') {
  virtual[which] = true;
  vibrate(8);
  setTimeout(() => (virtual[which] = false), 90);
}

export default function ObstacleSprint({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const portrait = usePortrait();
  const VW = portrait ? VW_TALL : VW_WIDE;
  const PX = portrait ? 170 : 260;
  const lastHits = useRef(0);
  const lastCleared = useRef(0);
  const swipe = useSwipe((d) => {
    if (d === 'up') pulse('a');
    else if (d === 'down') pulse('b');
  });
  return (
    <div className="g-stage full" style={{ position: 'relative' }} {...(isPlayer ? swipe : {})}>
      <GhostCanvas<SPWorld, SPState>
        def={sprintDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA
        worldSize={() => ({ w: VW, h: VH })}
        draw={(ctx, d) => {
          const w = d.world;
          const s = d.me;
          let mx = 0;
          let my = 0;
          if (s) {
            const p = d.prev ?? s;
            mx = lerp(p.x, s.x, d.alpha);
            my = lerp(p.y, s.y, d.alpha);
          } else if (d.others.length) mx = Math.max(...d.others.map((o) => o.s.x));
          const camX = mx - PX;
          const sky = ctx.createLinearGradient(0, 0, 0, VH);
          sky.addColorStop(0, '#ffb86b');
          sky.addColorStop(1, '#ffe3b3');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, VW, VH);
          // parallax hills
          ctx.fillStyle = '#f2a65a';
          ctx.beginPath();
          ctx.moveTo(0, GROUND);
          for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, GROUND - 60 - Math.sin((x + camX * 0.25) / 120) * 30);
          ctx.lineTo(VW, GROUND);
          ctx.fill();
          // track
          ctx.fillStyle = '#c0543a';
          ctx.fillRect(0, GROUND, VW, VH - GROUND);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          for (let x = -((camX % 120) + 120); x < VW; x += 120) ctx.fillRect(x, GROUND + 40, 60, 6);
          // obstacles
          for (let i = s ? Math.max(0, s.next - 2) : 0; i < w.obs.length; i++) {
            const o = w.obs[i];
            const sx = o.x - camX;
            if (sx < -100) continue;
            if (sx > VW + 100) break;
            const sh = SP_SHAPES[o.k];
            if (o.k === 'bar') {
              ctx.fillStyle = '#5d4aa8';
              ctx.fillRect(sx - sh.hw, GROUND - 200, 8, 200);
              ctx.fillRect(sx + sh.hw - 8, GROUND - 200, 8, 200);
              ctx.fillStyle = '#ff4f5f';
              roundRect(ctx, sx - sh.hw - 6, GROUND - sh.y0 - 26, sh.hw * 2 + 12, 26, 8);
              ctx.fill();
              text(ctx, '⬇', sx, GROUND - sh.y0 - 46, 24, '#fff');
            } else {
              ctx.fillStyle = o.k === 'tall' ? '#ffd23f' : '#fff';
              roundRect(ctx, sx - sh.hw, GROUND - sh.y1, sh.hw * 2, sh.y1, 6);
              ctx.fill();
              ctx.fillStyle = '#ff4f5f';
              for (let y = GROUND - sh.y1 + 8; y < GROUND - 6; y += 22) ctx.fillRect(sx - sh.hw, y, sh.hw * 2, 8);
            }
          }
          // ghosts at their relative positions
          for (const o of d.others) {
            if (o.s.o) continue;
            const gx = o.s.x - camX;
            if (gx < -40 || gx > VW + 40) continue;
            drawBloop(ctx, gx, GROUND - o.s.y - (o.s.sl ? 14 : 28), o.s.sl ? 16 : 22, player(o.id)?.avatar, { alpha: 0.35, squash: o.s.sl ? 0.55 : 1 });
          }
          if (s) {
            const blink = s.inv > 0 && Math.floor(performance.now() / 90) % 2 === 0;
            drawBloop(ctx, PX, GROUND - my - (s.slide ? 16 : 30), s.slide ? 20 : 26, player(me)?.avatar, { me: true, alpha: blink ? 0.4 : 1, squash: s.slide ? 0.55 : 1, mood: s.stumble ? 'shock' : 'happy' });
            if (s.hits > lastHits.current) {
              sfx('hit');
              vibrate(150);
            }
            if (s.cleared > lastCleared.current) sfx('tap', 1.4);
            lastHits.current = s.hits;
            lastCleared.current = s.cleared;
            text(ctx, '❤️'.repeat(Math.max(0, s.lives)) || '💀', 20, 34, 30, '#fff', 'left');
            text(ctx, `${Math.round(s.x / 50)} m`, VW - 20, 34, 34, '#7a2d12', 'right');
            if (s.out) text(ctx, 'Out of lives!', VW / 2, 160, 56, '#ff5a5f');
          }
          if (!d.started) text(ctx, 'Ready...', VW / 2, 160, 60, '#7a2d12');
        }}
      />
      {isPlayer && <TouchControls stick={false} a="JUMP" b="SLIDE" />}
    </div>
  );
}
