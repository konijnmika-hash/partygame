import './racing.css';
import { useEffect, useMemo, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { usePortrait } from '../../game/kit';
import { useInputStream } from '../../game/input';
import { LR, lavaX, makeLavaCourse } from '@shared/lavaRun';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const VH = LR.H;

interface Pub {
  t0: number;
  endsAt: number;
  p: { id: string; x: number; y: number; o: number; oa: number }[];
  o: { id: number; x: number; y: number; r: number }[];
  fx: { k: 'burn' | 'bonk'; x: number; y: number; at: number }[];
  left: number;
}

export default function SurvivalRun({ pub, pubT, me, isPlayer, input, player, assets }: GameViewProps<Pub>) {
  const VW = usePortrait() ? 620 : 1000;
  useInputStream(input, isPlayer);
  const info = assets['lava:course'] as { seed: number; diff: 'easy' | 'normal' | 'hard' } | undefined;
  const course = useMemo(() => (info ? makeLavaCourse(info.seed, info.diff) : null), [info?.seed, info?.diff]);
  const cam = useRef(0);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string };
    if (ev.type === 'burn') {
      sfx(d.id === me ? 'lose' : 'boom');
      if (d.id === me) vibrate([200, 80, 200]);
    }
  }, false), [me]);
  const meP = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: VW, h: VH }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const lava = course ? lavaX(course, d.t - s.t0) : 0;
          const alive = s.p.filter((p) => !p.o);
          const meNow = s.p.find((p) => p.id === me && !p.o);
          const focus = meNow ? meNow.x : alive.length ? Math.max(...alive.map((p) => p.x)) : lava + 300;
          const want = Math.max(0, Math.max(lava - 120, focus - VW * 0.42));
          cam.current += (want - cam.current) * Math.min(1, d.dt * 6);
          const cx = cam.current;
          const g = ctx.createLinearGradient(0, 0, 0, VH);
          g.addColorStop(0, '#5a3b2a');
          g.addColorStop(1, '#3a2418');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, VW, VH);
          ctx.save();
          ctx.translate(-cx, 0);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (let x = Math.floor(cx / 200) * 200; x < cx + VW + 200; x += 200) ctx.fillRect(x, 0, 100, VH);
          // distance markers
          for (let x = Math.ceil(cx / 500) * 500; x < cx + VW; x += 500) text(ctx, `${x / 50}m`, x, 24, 16, 'rgba(255,255,255,0.5)');
          if (course) {
            for (const w of course.walls) {
              if (w.x1 < cx - 50 || w.x0 > cx + VW + 50) continue;
              ctx.fillStyle = '#7a5a46';
              ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
              ctx.fillStyle = 'rgba(0,0,0,0.25)';
              ctx.fillRect(w.x1 - 8, w.y0, 8, w.y1 - w.y0);
            }
            for (const r of course.rocks) {
              if (r.x < cx - 80 || r.x > cx + VW + 80) continue;
              ctx.fillStyle = '#8c6a55';
              ctx.beginPath();
              ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,0.18)';
              ctx.beginPath();
              ctx.arc(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.35, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          for (const b of s.o) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(-b.x / b.r);
            ctx.fillStyle = '#6b5446';
            ctx.beginPath();
            ctx.arc(0, 0, b.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-b.r * 0.6, 0);
            ctx.lineTo(b.r * 0.6, 0);
            ctx.stroke();
            ctx.restore();
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.o) {
              const age = (d.t - p.oa) / 900;
              if (age < 1) text(ctx, '🔥', p.x, p.y - age * 40, 50);
              continue;
            }
            drawBloop(ctx, p.x, p.y, LR.R, m?.avatar, { name: m?.name, me: p.id === me, mood: p.x - lava < 140 ? 'shock' : undefined });
          }
          // the lava wall
          const lg = ctx.createLinearGradient(lava - 260, 0, lava + 30, 0);
          lg.addColorStop(0, '#ff3d00');
          lg.addColorStop(0.75, '#ff8a00');
          lg.addColorStop(1, 'rgba(255,210,63,0.9)');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(cx - 20, 0);
          for (let y = 0; y <= VH; y += 20) ctx.lineTo(lava + Math.sin(y / 40 + d.t / 160) * 14, y);
          ctx.lineTo(cx - 20, VH);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          if (d.t < s.t0) text(ctx, 'RUN! →', VW / 2, VH / 2 - 40, 70, '#ffd23f');
          if (meNow && meNow.x - lava < 160) text(ctx, '🔥 Too close! 🔥', VW / 2, 70, 34, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">🧍 {pub.left} left</span>
        {meP?.o ? <span className="ph-pill">Toasted! 🔥</span> : <span />}
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
