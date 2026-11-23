import './physics.css';
import { useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, type GhostPub } from '../../game/GhostCanvas';
import { stackDef, ST_RANGE, ST_HZ, type STState, type STWorld } from '@shared/ghosts/stack';
import { roundRect, text } from '../../game/canvas';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

const VW = 640;
const VH = 860;
const BH = 34;
const CX = VW / 2;

function hue(level: number): string {
  return `hsl(${(level * 23 + 190) % 360} 85% 62%)`;
}

export default function StackObjects({ pub, priv, me, isPlayer, send, players }: GameViewProps<GhostPub>) {
  const camY = useRef(0);
  const lastFx = useRef(0);
  const flash = useRef<{ kind: number; at: number }>({ kind: 0, at: 0 });
  const scores = Object.fromEntries(Object.entries(pub.p).map(([id, s]: [string, any]) => [id, s.h]));
  const endsAt = pub.t0 + (stackDef.maxTicks / ST_HZ) * 1000;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<STWorld, STState>
        def={stackDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA
        worldSize={() => ({ w: VW, h: VH })}
        draw={(ctx, d) => {
          const s = d.me;
          const h = s ? s.h : 0;
          // camera keeps the top of the stack in the upper third
          const want = Math.max(0, h * BH - 300);
          camY.current += (want - camY.current) * Math.min(1, d.dt * 6);
          const baseY = VH * 0.68 + camY.current;
          const g = ctx.createLinearGradient(0, 0, 0, VH);
          const k = Math.min(1, h / 40);
          g.addColorStop(0, `hsl(${250 - k * 40} 60% ${22 + k * 6}%)`);
          g.addColorStop(1, `hsl(${280 - k * 40} 55% ${36 + k * 8}%)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, VW, VH);
          // stars appear as you climb
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          for (let i = 0; i < 30; i++) {
            const sx = (i * 137) % VW;
            const sy = ((i * 89 + camY.current * 0.3) % VH);
            ctx.fillRect(sx, sy, 3, 3);
          }
          if (!s) {
            text(ctx, 'Spectating', CX, 120, 40);
            return;
          }
          const top = s.top;
          const firstLevel = s.h - (top.length - 1);
          // column of older blocks below the remembered ones
          if (firstLevel > 0) {
            const [bx, bw] = top[0];
            const y0 = baseY - firstLevel * BH;
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.fillRect(CX + bx - bw / 2, y0, bw, Math.min(VH + 40, firstLevel * BH + 200));
          }
          // ground
          ctx.fillStyle = '#2b1a63';
          ctx.fillRect(0, baseY + BH, VW, 400);
          top.forEach(([bx, bw], i) => {
            const level = firstLevel + i;
            const y = baseY - level * BH;
            if (y > VH + 40) return;
            ctx.fillStyle = level === 0 ? '#5d4aa8' : hue(level);
            roundRect(ctx, CX + bx - bw / 2, y, bw, BH - 2, 6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(CX + bx - bw / 2 + 4, y + 4, Math.max(0, bw - 8), 5);
          });
          // moving block
          const my = baseY - (s.h + 1) * BH;
          if (s.cd === 0 || s.fx !== 3) {
            ctx.fillStyle = hue(s.h + 1);
            roundRect(ctx, CX + s.mx - s.mw / 2, my, s.mw, BH - 2, 6);
            ctx.fill();
            // guide line to the top block
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.setLineDash([6, 8]);
            ctx.beginPath();
            const [tx] = top[top.length - 1];
            ctx.moveTo(CX + tx, my - 30);
            ctx.lineTo(CX + tx, my + BH);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // rails
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(CX - ST_RANGE - 100, my + BH / 2 - 2, (ST_RANGE + 100) * 2, 4);
          // effects
          if (s.fxAt !== lastFx.current) {
            lastFx.current = s.fxAt;
            flash.current = { kind: s.fx, at: performance.now() };
            if (s.fx === 2) sfx('ding', 1 + Math.min(0.6, s.streak * 0.08));
            else if (s.fx === 1) sfx('tap');
            else if (s.fx === 3) {
              sfx('hit');
              vibrate(120);
            }
          }
          const age = performance.now() - flash.current.at;
          if (age < 800) {
            const label = flash.current.kind === 2 ? (s.streak >= 3 ? `PERFECT x${s.streak}!` : 'PERFECT!') : flash.current.kind === 3 ? 'CRUMBLE! -2' : '';
            if (label) text(ctx, label, CX, my - 50 - age / 20, 44, flash.current.kind === 2 ? '#ffd23f' : '#ff8a8f');
          }
          text(ctx, `${s.h}`, CX, VH - 110, 64, '#fff');
          text(ctx, s.h === 1 ? 'block' : 'blocks', CX, VH - 66, 22, '#d6ccff');
          if (!d.started) text(ctx, 'Tap to drop!', CX, VH / 2, 52, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={scores} me={me} limit={4} title="Height" />
        <RankPill scores={scores} me={me} fmt={(v) => `${v} high`} />
        <SecondsLeft deadline={endsAt} />
      </div>
    </div>
  );
}
