import './racing.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { ropeDef, RP_CLEAR, type RPState, type RPWorld } from '@shared/ghosts/rope';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { sfx, vibrate } from '../../audio/sfx';

const VW = 900;
const VH = 600;
const FLOOR = 470;
const AXIS = 300;
const RY = 175;
// the two rope turners are friendly NPC Bloops
const TURNER_A = { color: 'c-tangerine', eyes: 'e-happy', mouth: 'm-grin', hat: 'h-none', acc: 'a-none' };
const TURNER_B = { color: 'c-mint', eyes: 'e-happy', mouth: 'm-grin', hat: 'h-none', acc: 'a-none' };

function ropeY(th: number): number {
  // th = 0 top, PI bottom; the rope's lowest point brushes the floor
  return AXIS - Math.cos(th) * RY;
}

export default function JumpChallenge({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const lastCleared = useRef(0);
  const lastMiss = useRef(-100);
  const flash = useRef(0);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<RPWorld, RPState>
        def={ropeDef}
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
          const tick = Math.max(0, Math.min(w.phase.length - 1, d.tick));
          const th0 = w.phase[Math.max(0, tick - 1)] ?? 0;
          const th1 = w.phase[tick] ?? 0;
          const th = lerp(th0, th1, d.alpha);
          const dbl = w.dbl[tick] === 1;
          // gym backdrop
          const g = ctx.createLinearGradient(0, 0, 0, VH);
          g.addColorStop(0, '#6b4fd8');
          g.addColorStop(1, '#2e1b78');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, VW, VH);
          ctx.fillStyle = '#ffb86b';
          ctx.fillRect(0, FLOOR, VW, VH - FLOOR);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          for (let x = 0; x < VW; x += 60) ctx.fillRect(x, FLOOR, 2, VH - FLOOR);
          // turners
          drawBloop(ctx, 70, FLOOR - 40, 34, TURNER_A, { mood: 'happy' });
          drawBloop(ctx, VW - 70, FLOOR - 40, 34, TURNER_B, { mood: 'happy', flip: true });
          const drawRope = (a: number, color: string, front: boolean) => {
            const y = ropeY(a);
            const isFront = Math.sin(a) < 0;
            if (isFront !== front) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(96, AXIS);
            ctx.quadraticCurveTo(VW / 2, y * 2 - AXIS, VW - 96, AXIS);
            ctx.stroke();
          };
          // back rope(s) first, then jumpers, then front rope(s)
          drawRope(th, '#ff4f9a', false);
          if (dbl) drawRope(th + Math.PI, '#3da9fc', false);
          const n = d.others.length;
          d.others.forEach((o, i) => {
            if (o.s.o) return;
            const x = VW / 2 + (i - (n - 1) / 2) * Math.min(70, 520 / Math.max(1, n));
            drawBloop(ctx, x, FLOOR - 70 - o.s.y * 0.8, 18, player(o.id)?.avatar, { alpha: 0.4 });
          });
          if (s) {
            const p = d.prev ?? s;
            const y = lerp(p.y, s.y, d.alpha);
            drawBloop(ctx, VW / 2, FLOOR - 32 - y, 32, player(me)?.avatar, { me: true, mood: s.stun > 0 ? 'shock' : y > RP_CLEAR ? 'happy' : undefined, squash: y > 0 ? 0.92 : 1 });
            if (s.cleared > lastCleared.current) {
              sfx('tick');
              if (s.streak > 0 && s.streak % 10 === 0) sfx('cheer');
            }
            if (s.missAt !== lastMiss.current && s.missAt > 0) {
              flash.current = performance.now();
              sfx('wrong');
              vibrate(160);
            }
            lastCleared.current = s.cleared;
            lastMiss.current = s.missAt;
          }
          drawRope(th, '#ff4f9a', true);
          if (dbl) drawRope(th + Math.PI, '#3da9fc', true);
          if (performance.now() - flash.current < 350) {
            ctx.fillStyle = 'rgba(255,90,95,0.25)';
            ctx.fillRect(0, 0, VW, VH);
          }
          if (s) {
            text(ctx, '❤️'.repeat(Math.max(0, s.lives)) || '💀', 24, 40, 32, '#fff', 'left');
            text(ctx, `${s.cleared}`, VW / 2, 60, 64, '#ffd23f');
            text(ctx, s.streak > 2 ? `streak ${s.streak} 🔥` : 'jumps', VW / 2, 104, 24, '#fff');
            if (dbl) text(ctx, 'DOUBLE ROPE!', VW - 24, 40, 28, '#3da9fc', 'right');
            if (s.out) text(ctx, 'Tangled up! 🪢', VW / 2, 200, 54, '#ff8a8f');
          }
          if (!d.started) text(ctx, 'Tap to jump!', VW / 2, 200, 54, '#fff');
        }}
      />
      {isPlayer && <TouchControls stick={false} a="JUMP" />}
    </div>
  );
}
