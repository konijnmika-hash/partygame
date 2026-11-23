import './arcade.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, text } from '../../game/canvas';
import { useInputStream, isTouchDevice, virtual } from '../../game/input';
import { SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { colorOf } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

const C = 500;
const BALL_R = 12;

interface SideP { ax: number; ay: number; bx: number; by: number; o: string | null }
interface Pub {
  t0: number;
  endsAt: number;
  sides: SideP[];
  p: { id: string; x: number }[];
  lives: Record<string, number>;
  padLen: number;
  o: { id: number; x: number; y: number; w: number }[];
  fx: { x: number; y: number; at: number; k: 'goal' | 'hit' }[];
}

function geom(sd: SideP) {
  const mx = (sd.ax + sd.bx) / 2;
  const my = (sd.ay + sd.by) / 2;
  const l = Math.hypot(C - mx, C - my) || 1;
  const nx = (C - mx) / l;
  const ny = (C - my) / l;
  return { mx, my, nx, ny, rx: -ny, ry: nx, len: Math.hypot(sd.bx - sd.ax, sd.by - sd.ay) };
}

/** Hold-to-move buttons for touch screens (left / right along your side). */
function HoldPads() {
  const hold = (x: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    virtual.active = true;
    virtual.x = x;
    virtual.y = 0;
    vibrate(8);
  };
  const release = () => {
    virtual.active = false;
    virtual.x = 0;
  };
  useEffect(() => release, []);
  return (
    <div className="turn-pads">
      <button className="turn-pad" aria-label="Move left" onPointerDown={hold(-1)} onPointerUp={release} onPointerCancel={release} onContextMenu={(e) => e.preventDefault()}>◀</button>
      <button className="turn-pad" aria-label="Move right" onPointerDown={hold(1)} onPointerUp={release} onPointerCancel={release} onContextMenu={(e) => e.preventDefault()}>▶</button>
    </div>
  );
}

export default function PaddleRoyale({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const lastHit = useRef(0);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string; lives: number };
    if (ev.type === 'miss') {
      if (d.id === me) {
        sfx(d.lives > 0 ? 'wrong' : 'lose');
        vibrate([140, 50, 140]);
      } else sfx('buzz', 0.9);
    }
  }, false), [me]);
  const mySide = pub.sides.find((sd) => sd.o === me);
  // rotate the arena so your own side sits at the bottom of the screen
  let rot = 0;
  if (mySide) {
    const g = geom(mySide);
    rot = -Math.PI / 2 - Math.atan2(g.ny, g.nx);
  }
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const T = (x: number, y: number): [number, number] => [C + (x - C) * cr - (y - C) * sr, C + (x - C) * sr + (y - C) * cr];
  const myLives = pub.lives[me];
  const left = Object.values(pub.lives).filter((l) => l > 0).length;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 1000 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#120a33';
          ctx.fillRect(0, 0, 1000, 1000);
          // arena floor
          ctx.beginPath();
          s.sides.forEach((sd, k) => {
            const [x, y] = T(sd.ax, sd.ay);
            if (k) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
          ctx.closePath();
          const grad = ctx.createRadialGradient(C, C, 40, C, C, 460);
          grad.addColorStop(0, '#2c1f6b');
          grad.addColorStop(1, '#1a1048');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineCap = 'round';
          const padOf = new Map(s.p.map((p) => [p.id, p.x]));
          s.sides.forEach((sd, k) => {
            const g = geom(sd);
            const [ax, ay] = T(sd.ax, sd.ay);
            const [bx, by] = T(sd.bx, sd.by);
            const alive = sd.o && (s.lives[sd.o] ?? 0) > 0;
            if (!alive) {
              // a solid wall
              ctx.strokeStyle = '#8a7fb8';
              ctx.lineWidth = 16;
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
              ctx.stroke();
              return;
            }
            const col = colorOf(players, sd.o!, k);
            ctx.strokeStyle = `${col}66`;
            ctx.lineWidth = 6;
            ctx.setLineDash([14, 12]);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.setLineDash([]);
            const u = padOf.get(sd.o!) ?? 0;
            const half = (g.len * s.padLen) / 2;
            const [p0x, p0y] = T(g.mx + g.rx * (u - half) + g.nx * 4, g.my + g.ry * (u - half) + g.ny * 4);
            const [p1x, p1y] = T(g.mx + g.rx * (u + half) + g.nx * 4, g.my + g.ry * (u + half) + g.ny * 4);
            ctx.strokeStyle = col;
            ctx.lineWidth = 18;
            ctx.beginPath();
            ctx.moveTo(p0x, p0y);
            ctx.lineTo(p1x, p1y);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 4;
            ctx.stroke();
            // the defender, just behind their side
            const [hx, hy] = T(g.mx - g.nx * 38, g.my - g.ny * 38);
            const m = player(sd.o!);
            drawBloop(ctx, hx, hy, 18, m?.avatar, { me: sd.o === me });
            const lives = s.lives[sd.o!] ?? 0;
            text(ctx, `${sd.o === me ? 'YOU' : m?.name ?? ''} ${'❤️'.repeat(lives)}`, hx, hy + (hy > C ? 34 : -30), 18, '#fff');
          });
          for (const b of s.o) {
            const [x, y] = T(b.x, b.y);
            const wait = b.w ? 0.45 + Math.sin(d.t / 90) * 0.25 : 1;
            ctx.globalAlpha = wait;
            ctx.fillStyle = 'rgba(255,224,102,0.3)';
            ctx.beginPath();
            ctx.arc(x, y, BALL_R * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff6c9';
            ctx.beginPath();
            ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          for (const f of (d.latest as Pub).fx) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            const [x, y] = T(f.x, f.y);
            if (f.k === 'hit') {
              if (f.at > lastHit.current) {
                lastHit.current = f.at;
                sfx('tap', 1.2);
              }
              ctx.strokeStyle = `rgba(255,255,255,${1 - age})`;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(x, y, 14 + age * 30, 0, Math.PI * 2);
              ctx.stroke();
            } else text(ctx, '−1 ❤️', x, y - age * 40, 30, '#ff8a8f');
          }
          if (d.t < s.t0) text(ctx, mySide ? 'Defend your side! ⬇' : 'Get ready…', C, C, 48, '#fff');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">🏓 {left} still in</span>
        {myLives != null && <span className={`ph-pill ${myLives > 0 ? 'gold' : ''}`}>{myLives > 0 ? '❤️'.repeat(myLives) : '💀 Knocked out'}</span>}
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && isTouchDevice() && myLives > 0 && <HoldPads />}
    </div>
  );
}
