import './physics.css';
import { useEffect, useMemo, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { SecondsLeft } from '../../game/kit';
import { OC, makeCourse, sliderAt, spinnerEnds } from '@shared/obstacleCourse';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const VW = 1000;
const VH = 700;

interface Pub {
  t0: number;
  endsAt: number;
  p: { id: string; x: number; y: number; f: number; pl: number }[];
  fx: { k: 'bonk' | 'boost'; x: number; y: number; at: number }[];
}

export default function ObstacleCourse({ pub, pubT, me, isPlayer, input, player, assets }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const info = assets['oc:course'] as { seed: number; diff: 'easy' | 'normal' | 'hard' } | undefined;
  const course = useMemo(() => (info ? makeCourse(info.seed, info.diff) : null), [info?.seed, info?.diff]);
  const cam = useRef(OC.START_Y - VH + 160);
  const lastFx = useRef(0);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'finish') {
      const d = ev.data as { id: string; place: number };
      if (d.id === me) {
        sfx(d.place === 1 ? 'win' : 'cheer');
        vibrate([60, 40, 60]);
      } else sfx('ding');
    }
  }, false), [me]);
  useEffect(() => {
    for (const f of pub.fx) {
      if (f.at <= lastFx.current) continue;
      lastFx.current = f.at;
      const mine = pub.p.find((p) => p.id === me);
      if (mine && Math.hypot(mine.x - f.x, mine.y - f.y) < 140) sfx(f.k === 'boost' ? 'whoosh' : 'hit');
    }
  }, [pub.fx]);
  const mine = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: VW, h: VH }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const meP = s.p.find((p) => p.id === me) ?? s.p.reduce((a, b) => (b.y < a.y ? b : a), s.p[0]);
          const want = Math.max(0, Math.min(OC.H - VH, (meP?.y ?? OC.START_Y) - VH * 0.62));
          cam.current += (want - cam.current) * Math.min(1, d.dt * 6);
          const cy = cam.current;
          const t = Math.max(0, (d.t - s.t0) / 1000);
          ctx.fillStyle = '#8fe388';
          ctx.fillRect(0, 0, VW, VH);
          ctx.save();
          ctx.translate(0, -cy);
          // track with alternating section colours
          if (course) {
            course.sections.forEach((sec, i) => {
              ctx.fillStyle = i % 2 ? '#bff0b6' : '#d2f7c8';
              ctx.fillRect(0, sec.y0, VW, sec.y1 - sec.y0);
            });
          }
          // start + finish
          ctx.fillStyle = '#ffe9a8';
          ctx.fillRect(0, OC.START_Y - 60, VW, 200);
          text(ctx, 'START', VW / 2, OC.START_Y + 90, 40, '#c47b00');
          for (let x = 0; x < VW; x += 40) {
            for (let k = 0; k < 2; k++) {
              ctx.fillStyle = (x / 40 + k) % 2 ? '#1d1442' : '#fff';
              ctx.fillRect(x, OC.FINISH_Y - 40 + k * 20, 40, 20);
            }
          }
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(0, 0, VW, OC.FINISH_Y - 40);
          text(ctx, '🏆 FINISH', VW / 2, OC.FINISH_Y - 110, 54, '#fff');
          if (course) {
            for (const bo of course.boosters) {
              ctx.fillStyle = '#3da9fc';
              ctx.beginPath();
              ctx.arc(bo.x, bo.y, bo.r, 0, Math.PI * 2);
              ctx.fill();
              text(ctx, '⏫', bo.x, bo.y, 40);
            }
            ctx.fillStyle = '#5d4aa8';
            for (const w of course.walls) {
              roundRect(ctx, w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0, 10);
              ctx.fill();
            }
            for (const bm of course.bumpers) {
              ctx.fillStyle = '#c2185b';
              ctx.beginPath();
              ctx.arc(bm.x, bm.y + 6, bm.r, 0, Math.PI * 2);
              ctx.fill();
              const g = ctx.createRadialGradient(bm.x - bm.r * 0.3, bm.y - bm.r * 0.3, 4, bm.x, bm.y, bm.r);
              g.addColorStop(0, '#ffb3d6');
              g.addColorStop(1, '#ff4f9a');
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2);
              ctx.fill();
            }
            for (const sl of course.sliders) {
              const at = sliderAt(sl, t);
              ctx.fillStyle = '#ff8a3d';
              roundRect(ctx, at.x - sl.hw, sl.y - sl.hh, sl.hw * 2, sl.hh * 2, 12);
              ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,0.35)';
              for (let k = -sl.hw + 20; k < sl.hw - 10; k += 40) ctx.fillRect(at.x + k, sl.y - sl.hh + 6, 18, 8);
            }
            for (const sp of course.spinners) {
              const e = spinnerEnds(sp, t);
              ctx.lineCap = 'round';
              ctx.strokeStyle = '#1d1442';
              ctx.lineWidth = sp.th * 2 + 6;
              ctx.beginPath();
              ctx.moveTo(e.ax, e.ay);
              ctx.lineTo(e.bx, e.by);
              ctx.stroke();
              ctx.strokeStyle = '#ffd23f';
              ctx.lineWidth = sp.th * 2;
              ctx.beginPath();
              ctx.moveTo(e.ax, e.ay);
              ctx.lineTo(e.bx, e.by);
              ctx.stroke();
              ctx.fillStyle = '#1d1442';
              ctx.beginPath();
              ctx.arc(sp.x, sp.y, 16, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          for (const f of d.latest.fx as Pub['fx']) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            text(ctx, f.k === 'boost' ? '💨' : '💥', f.x, f.y - age * 30, 34);
          }
          for (const p of s.p) {
            const m = player(p.id);
            drawBloop(ctx, p.x, p.y, OC.R, m?.avatar, { name: m?.name, me: p.id === me, alpha: p.f ? 0.75 : 1, mood: p.f ? 'happy' : undefined });
            if (p.pl) text(ctx, `#${p.pl}`, p.x + 30, p.y - 30, 24, '#ffd23f');
          }
          ctx.restore();
          // progress rail
          const top = 60;
          const bot = VH - 60;
          ctx.fillStyle = 'rgba(20,8,50,0.45)';
          roundRect(ctx, VW - 34, top, 14, bot - top, 7);
          ctx.fill();
          for (const p of s.p) {
            const k = Math.max(0, Math.min(1, (OC.START_Y - p.y) / (OC.START_Y - OC.FINISH_Y)));
            ctx.fillStyle = p.id === me ? '#ffd23f' : '#fff';
            ctx.beginPath();
            ctx.arc(VW - 27, bot - k * (bot - top), p.id === me ? 10 : 7, 0, Math.PI * 2);
            ctx.fill();
          }
          if (d.t < s.t0) text(ctx, `${Math.max(1, Math.ceil((s.t0 - d.t) / 1000))}`, VW / 2, VH / 2 - 60, 90, '#ffd23f');
          const meNow = s.p.find((p) => p.id === me);
          if (meNow?.f) text(ctx, `Finished #${meNow.pl}! ${(meNow.f / 1000).toFixed(2)}s`, VW / 2, 120, 44, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">{mine?.pl ? `🏁 #${mine.pl}` : `${pub.p.filter((p) => p.f).length}/${pub.p.length} finished`}</span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
