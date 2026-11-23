import './reaction.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { reflexMazeDef, rmPos, DX, DY, type RMState, type RMWorld } from '@shared/ghosts/reflexMaze';
import { drawBloop, text } from '../../game/canvas';
import { DPad, useSwipe } from '../../game/kit';
import { virtual, isTouchDevice } from '../../game/input';
import { sfx, vibrate } from '../../audio/sfx';

const CELL = 90;
const VIEW = 900;

function pulse(d: 'up' | 'down' | 'left' | 'right') {
  const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
  virtual.x = v[0];
  virtual.y = v[1];
  virtual.active = true;
  vibrate(8);
  setTimeout(() => {
    virtual.active = false;
    virtual.x = 0;
    virtual.y = 0;
  }, 90);
}

export default function ReflexMaze({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const lastLives = useRef(3);
  const swipe = useSwipe(pulse);
  return (
    <div className="g-stage full" style={{ position: 'relative', gap: 0 }} {...(isPlayer ? swipe : {})}>
      <GhostCanvas<RMWorld, RMState>
        def={reflexMazeDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA={false}
        worldSize={() => ({ w: VIEW, h: VIEW })}
        draw={(ctx, d) => {
          const w = d.world;
          const meS = d.me;
          let cam = { x: 0, y: 0 };
          if (meS) {
            const p = rmPos(w, meS);
            const pp = d.prev ? rmPos(w, d.prev) : p;
            cam = { x: lerp(pp.x, p.x, d.alpha), y: lerp(pp.y, p.y, d.alpha) };
            if (meS.lives < lastLives.current) {
              sfx('hit');
              vibrate(120);
            }
            lastLives.current = meS.lives;
          } else if (d.others[0]) cam = d.others[0].s;
          ctx.save();
          ctx.fillStyle = '#1b0f3d';
          ctx.fillRect(0, 0, VIEW, VIEW);
          ctx.translate(VIEW / 2 - cam.x * CELL, VIEW / 2 - cam.y * CELL);
          const seg = meS ? meS.seg : 0;
          // corridor
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const [width, color] of [[CELL * 0.86, '#ff4f9a'], [CELL * 0.7, '#3b2486']] as const) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            for (let i = Math.max(0, seg - 3); i < Math.min(w.pts.length, seg + 14); i++) {
              const p = w.pts[i];
              if (i === Math.max(0, seg - 3)) ctx.moveTo(p.x * CELL, p.y * CELL);
              else ctx.lineTo(p.x * CELL, p.y * CELL);
            }
            ctx.stroke();
          }
          // floor dots for speed feeling
          ctx.fillStyle = 'rgba(255,255,255,.18)';
          for (let i = Math.max(0, seg - 2); i < Math.min(w.dirs.length, seg + 12); i++) {
            const p = w.pts[i];
            for (let k = 0; k < w.lens[i]; k++) {
              ctx.beginPath();
              ctx.arc((p.x + DX[w.dirs[i]] * k) * CELL, (p.y + DY[w.dirs[i]] * k) * CELL, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          for (const o of d.others) drawBloop(ctx, o.s.x * CELL, o.s.y * CELL, 26, player(o.id)?.avatar, { alpha: 0.35 });
          if (meS) drawBloop(ctx, cam.x * CELL, cam.y * CELL, 30, player(me)?.avatar, { me: true, mood: meS.pause > 0 ? 'shock' : undefined });
          ctx.restore();
          if (meS) {
            text(ctx, '❤️'.repeat(Math.max(0, meS.lives)) || '💀', 20, 36, 30, '#fff', 'left');
            text(ctx, `${Math.round(meS.dist)} m`, VIEW - 20, 36, 34, '#ffd23f', 'right');
            if (meS.pause > 0) text(ctx, 'CRASH!', VIEW / 2, VIEW / 2 - 90, 64, '#ff5a5f');
            if (meS.queued >= 0) text(ctx, ['➡️', '⬇️', '⬅️', '⬆️'][meS.queued], VIEW / 2, VIEW - 60, 46);
          }
          if (!d.started) text(ctx, 'Get ready!', VIEW / 2, VIEW / 2 - 100, 60, '#fff');
          if (d.done && meS) text(ctx, meS.lives > 0 ? 'Finished!' : 'Out of lives!', VIEW / 2, VIEW / 2 - 120, 56, '#ffd23f');
        }}
      />
      {isPlayer && isTouchDevice() && (
        <div className="ctrl-bar">
          <DPad onDir={pulse} />
        </div>
      )}
    </div>
  );
}
