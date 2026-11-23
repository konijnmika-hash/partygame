import './physics.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { hillRaceDef, groundY, HR_HZ, HR_LEN, HR_CAR_H, type HRState, type HRWorld } from '@shared/ghosts/hillRace';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { isTouchDevice, virtual } from '../../game/input';
import { usePortrait } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

const VW_WIDE = 1000;
const VW_TALL = 620;
const VH = 560;
const CAR_COLORS = ['#ff4f5f', '#3da9fc', '#34cf78', '#ffb21f', '#a46bff', '#ff7ac8', '#2ad4c4', '#ff8a3d'];

function Pedal({ which, label }: { which: 'a' | 'b'; label: string }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => {
    virtual[which] = v;
    setDown(v);
    if (v) vibrate(10);
  };
  useEffect(() => () => {
    virtual[which] = false;
  }, [which]);
  return (
    <button
      className={`pedal ${which === 'a' ? 'gas' : 'brake'} ${down ? 'down' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, avatar: any, alpha = 1, flipped = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(-a + (flipped ? Math.PI : 0));
  // wheels
  for (const wx of [-26, 26]) {
    ctx.beginPath();
    ctx.arc(wx, HR_CAR_H - 6, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#1d1442';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx, HR_CAR_H - 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#c9c4e6';
    ctx.fill();
  }
  // body
  ctx.fillStyle = color;
  roundRect(ctx, -40, -10, 80, 24, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -34, -7, 30, 7, 4);
  ctx.fill();
  ctx.restore();
  // driver sits on top (kept upright-ish so the face stays readable)
  ctx.save();
  ctx.globalAlpha = alpha;
  const dx = Math.sin(a) * -18;
  const dy = Math.cos(a) * -18;
  drawBloop(ctx, x + dx, y + dy - 6, 15, avatar, { mood: flipped ? 'shock' : 'happy' });
  ctx.restore();
}

export default function PhysicsRace({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const VW = usePortrait() ? VW_TALL : VW_WIDE;
  const cam = useRef({ x: 0, y: 0, init: false });
  const lastFlips = useRef(0);
  const lastPerfect = useRef(0);
  const perfectAt = useRef(-9999);
  const ids = Object.keys(pub.p);
  const colorOf = (id: string) => CAR_COLORS[Math.max(0, ids.indexOf(id)) % CAR_COLORS.length];
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<HRWorld, HRState>
        def={hillRaceDef}
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
          // follow my car (or the leader when spectating)
          let fx = 0;
          let fy = 300;
          let fa = 0;
          if (s) {
            const p = d.prev ?? s;
            fx = lerp(p.x, s.x, d.alpha);
            fy = lerp(p.y, s.y, d.alpha);
            fa = lerp(p.a, s.a, d.alpha);
          } else if (d.others.length) {
            const lead = d.others.reduce((a, b) => (b.s.x > a.s.x ? b : a));
            fx = lead.s.x;
            fy = lead.s.y;
          }
          const c = cam.current;
          const tx = fx - VW * 0.32;
          const ty = fy - 330;
          if (!c.init) {
            c.x = tx;
            c.y = ty;
            c.init = true;
          }
          c.x = tx;
          c.y += (ty - c.y) * Math.min(1, d.dt * 5);
          // sky + parallax hills
          const sky = ctx.createLinearGradient(0, 0, 0, VH);
          sky.addColorStop(0, '#6fd0ff');
          sky.addColorStop(1, '#d9f4ff');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, VW, VH);
          ctx.fillStyle = '#b5e3a1';
          ctx.beginPath();
          ctx.moveTo(0, VH);
          for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, 330 + Math.sin((x + c.x * 0.3) / 140) * 40 - (c.y - 0) * 0.15);
          ctx.lineTo(VW, VH);
          ctx.fill();
          ctx.save();
          ctx.translate(-c.x, -c.y);
          // terrain
          const x0 = Math.floor(c.x / 10) * 10 - 20;
          ctx.beginPath();
          ctx.moveTo(x0, c.y + VH + 50);
          for (let x = x0; x <= c.x + VW + 30; x += 10) ctx.lineTo(x, groundY(w, x));
          ctx.lineTo(c.x + VW + 30, c.y + VH + 50);
          ctx.closePath();
          ctx.fillStyle = '#9b6a3c';
          ctx.fill();
          ctx.beginPath();
          for (let x = x0; x <= c.x + VW + 30; x += 10) (x === x0 ? ctx.moveTo(x, groundY(w, x)) : ctx.lineTo(x, groundY(w, x)));
          ctx.lineWidth = 16;
          ctx.strokeStyle = '#47c45e';
          ctx.stroke();
          // distance flags
          for (const f of w.flags) {
            if (f < c.x - 50 || f > c.x + VW + 50) continue;
            const gy = groundY(w, f);
            ctx.fillStyle = '#fff';
            ctx.fillRect(f - 2, gy - 70, 4, 70);
            text(ctx, `${f / 100}m`, f + 20, gy - 62, 18, '#1d1442', 'left', 900);
          }
          // finish line
          if (HR_LEN > c.x - 60 && HR_LEN < c.x + VW + 60) {
            const gy = groundY(w, HR_LEN);
            for (let i = 0; i < 8; i++) {
              for (let k = 0; k < 2; k++) {
                ctx.fillStyle = (i + k) % 2 ? '#1d1442' : '#fff';
                ctx.fillRect(HR_LEN - 10 + k * 10, gy - 160 + i * 20, 10, 20);
              }
            }
            text(ctx, '🏁', HR_LEN, gy - 190, 40);
          }
          // ghosts
          for (const o of d.others) drawCar(ctx, o.s.x, o.s.y, o.s.a, colorOf(o.id), player(o.id)?.avatar, 0.35, !!o.s.f);
          if (s) {
            drawCar(ctx, fx, fy, fa, colorOf(me), player(me)?.avatar, 1, s.flipped > 0);
            if (s.flips > lastFlips.current) {
              sfx('boom');
              vibrate([80, 40, 80]);
            }
            if (s.perfect > lastPerfect.current) {
              perfectAt.current = performance.now();
              sfx('coin', 1.2);
            }
            lastFlips.current = s.flips;
            lastPerfect.current = s.perfect;
          }
          ctx.restore();
          // HUD: progress strip with every racer
          ctx.fillStyle = 'rgba(20,8,50,0.55)';
          roundRect(ctx, 120, 18, VW - 240, 14, 7);
          ctx.fill();
          for (const o of d.others) {
            ctx.fillStyle = colorOf(o.id);
            ctx.beginPath();
            ctx.arc(120 + Math.min(1, o.s.x / HR_LEN) * (VW - 240), 25, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          if (s) {
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.arc(120 + Math.min(1, s.x / HR_LEN) * (VW - 240), 25, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#1d1442';
            ctx.stroke();
            const secs = (s.finished || d.tick) / HR_HZ;
            text(ctx, `${secs.toFixed(1)}s`, 20, 60, 30, '#fff', 'left');
            if (s.flipped > 0) text(ctx, 'FLIPPED! 🙃', VW / 2, 140, 54, '#ff5a5f');
            if (s.air && s.flipped === 0) text(ctx, 'AIR!', VW / 2, 120, 34, '#fff');
            if (performance.now() - perfectAt.current < 900) text(ctx, 'Perfect landing! +speed', VW / 2, 180, 34, '#ffd23f');
            if (s.finished) text(ctx, `Finished in ${(s.finished / HR_HZ).toFixed(2)}s!`, VW / 2, 200, 48, '#ffd23f');
          }
          if (!d.started) text(ctx, 'Ready...', VW / 2, 200, 60, '#fff');
        }}
      />
      {isPlayer && isTouchDevice() && (
        <div className="pedals">
          <Pedal which="b" label="BRAKE" />
          <Pedal which="a" label="GAS" />
        </div>
      )}
    </div>
  );
}
