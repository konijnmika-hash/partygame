import './physics.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { subscribeGameEvents } from '../../state/store';
import { FP, FP_H, FP_W } from '@shared/fallingPlatforms';
import { sfx, vibrate } from '../../audio/sfx';

const { COLS, TILE, OX, OY } = FP;
const W = FP_W;
const H = FP_H;

interface Pub {
  t0: number;
  endsAt: number;
  tiles: number[];
  p: { id: string; x: number; y: number; o: number; oa: number; j: number }[];
  left: number;
  decay: boolean;
}

function tileColor(v: number): string {
  // 0 fresh -> 9 nearly worn through
  const k = Math.min(1, v / 9);
  const h = 170 - k * 150;
  return `hsl(${h} 70% ${62 - k * 10}%)`;
}

export default function FallingPlatforms({ pub, pubT, me, isPlayer, input, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'fall') {
      const d = ev.data as { id: string };
      sfx(d.id === me ? 'lose' : 'whoosh');
      if (d.id === me) vibrate([150, 60, 150]);
    }
  }, false), [me]);
  useEffect(() => {
    if (pub.decay) sfx('buzz');
  }, [pub.decay]);
  const meP = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const tiles = (d.latest as Pub).tiles;
          // the abyss
          const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
          g.addColorStop(0, '#2a1666');
          g.addColorStop(1, '#0b0522');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
          for (let i = 0; i < tiles.length; i++) {
            const v = tiles[i];
            if (v < 0) continue;
            const x = OX + (i % COLS) * TILE;
            const y = OY + Math.floor(i / COLS) * TILE;
            const shake = v === 10 ? Math.sin(d.t / 25 + i) * 3 : 0;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            roundRect(ctx, x + 4 + shake, y + 10, TILE - 8, TILE - 8, 10);
            ctx.fill();
            ctx.fillStyle = v === 10 ? '#ff5a5f' : tileColor(v);
            roundRect(ctx, x + 4 + shake, y + 4, TILE - 8, TILE - 8, 10);
            ctx.fill();
            if (v > 0 && v < 10) {
              // cracks grow with wear
              ctx.strokeStyle = 'rgba(40,20,60,0.55)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              const cx = x + TILE / 2;
              const cy = y + TILE / 2;
              for (let k = 0; k < Math.min(5, Math.ceil(v / 2)); k++) {
                const a = (i * 1.7 + k * 2.1) % (Math.PI * 2);
                const len = 10 + v * 3;
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
                ctx.lineTo(cx + Math.cos(a + 0.4) * len * 1.3, cy + Math.sin(a + 0.4) * len * 1.3);
              }
              ctx.stroke();
            }
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.o) {
              const age = (d.t - p.oa) / 900;
              if (age > 1) continue;
              drawBloop(ctx, p.x, p.y + age * 30, 22 * (1 - age * 0.8), m?.avatar, { alpha: 1 - age, mood: 'shock' });
              continue;
            }
            const lift = p.j ? Math.sin(p.j * Math.PI) * 34 : 0;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 20, 20 - lift * 0.2, 8 - lift * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            drawBloop(ctx, p.x, p.y - lift, 22 + lift * 0.12, m?.avatar, { name: m?.name, me: p.id === me, mood: p.j ? 'happy' : undefined });
          }
          if (d.t < s.t0) text(ctx, 'Keep moving!', W / 2, H / 2 - 40, 60, '#ffd23f');
          if (s.decay) text(ctx, '⚠️ The floor is crumbling!', W / 2, 40, 30, '#ff8a8f');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">🧍 {pub.left} left</span>
        {meP?.o ? <span className="ph-pill">You fell! 😵</span> : <span />}
      </div>
      {isPlayer && <TouchControls a="JUMP" />}
    </div>
  );
}
