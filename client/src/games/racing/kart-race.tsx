import './racing.css';
import { useEffect, useMemo, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { usePortrait } from '../../game/kit';
import { useInputStream } from '../../game/input';
import { KT, makeTrack, type KartTrack } from '@shared/kartTrack';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const KART_COLORS = ['#ff4f5f', '#3da9fc', '#34cf78', '#ffb21f', '#a46bff', '#ff7ac8', '#2ad4c4', '#ff8a3d', '#8bd450', '#f25f5c', '#5b8def', '#c77dff'];

interface Pub {
  t0: number;
  endsAt: number;
  p: { id: string; x: number; y: number; a: number; lap: number; f: number; pl: number; bo: number; sp: number; pos: number }[];
  fx: { k: 'boost' | 'spin' | 'bump'; x: number; y: number; at: number }[];
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

function drawTrack(ctx: CanvasRenderingContext2D, t: KartTrack) {
  const path = () => {
    ctx.beginPath();
    t.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = KT.HALF * 2 + 22;
  ctx.stroke();
  path();
  ctx.setLineDash([26, 26]);
  ctx.strokeStyle = '#ff4f5f';
  ctx.lineWidth = KT.HALF * 2 + 22;
  ctx.stroke();
  ctx.setLineDash([]);
  path();
  ctx.strokeStyle = '#5b5677';
  ctx.lineWidth = KT.HALF * 2;
  ctx.stroke();
  path();
  ctx.setLineDash([30, 40]);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.setLineDash([]);
  // start / finish line
  const p0 = t.pts[0];
  const p1 = t.pts[1];
  const a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  ctx.save();
  ctx.translate(p0.x, p0.y);
  ctx.rotate(a);
  for (let i = -4; i < 4; i++) {
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = (i + k) % 2 ? '#1d1442' : '#fff';
      ctx.fillRect(-10 + k * 10, i * 20, 10, 20);
    }
  }
  ctx.restore();
  for (const b of t.boosts) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.fillStyle = '#ffd23f';
    roundRect(ctx, -34, -24, 68, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    for (const off of [-14, 6]) {
      ctx.beginPath();
      ctx.moveTo(off, -14);
      ctx.lineTo(off + 16, 0);
      ctx.lineTo(off, 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  for (const o of t.oils) {
    ctx.fillStyle = 'rgba(25,15,40,0.85)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r * 1.2, o.r * 0.85, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,120,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(o.x - 8, o.y - 6, o.r * 0.4, o.r * 0.22, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function KartRace({ pub, pubT, me, isPlayer, input, player, assets }: GameViewProps<Pub>) {
  const portrait = usePortrait();
  const VW = portrait ? 640 : 1000;
  const VH = portrait ? 900 : 650;
  useInputStream(input, isPlayer);
  const info = assets['kart:track'] as { seed: number } | undefined;
  const track = useMemo(() => (info ? makeTrack(info.seed) : null), [info?.seed]);
  const cam = useRef({ x: 0, y: 0, init: false });
  const lastFx = useRef(0);
  const color = (id: string) => KART_COLORS[Math.max(0, pub.p.findIndex((p) => p.id === id)) % KART_COLORS.length];
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string; place?: number; lap?: number };
    if (ev.type === 'finish' && d.id === me) sfx(d.place === 1 ? 'win' : 'cheer');
    else if (ev.type === 'lap' && d.id === me) sfx('ding');
    else if (ev.type === 'spin' && d.id === me) {
      sfx('swap');
      vibrate(150);
    }
  }, false), [me]);
  useEffect(() => {
    const mine = pub.p.find((p) => p.id === me);
    for (const f of pub.fx) {
      if (f.at <= lastFx.current) continue;
      lastFx.current = f.at;
      if (mine && Math.hypot(mine.x - f.x, mine.y - f.y) < 200) sfx(f.k === 'boost' ? 'whoosh' : f.k === 'bump' ? 'hit' : 'swap');
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
          const meK = s.p.find((p) => p.id === me) ?? s.p.reduce((a, b) => (b.pos < a.pos ? b : a), s.p[0]);
          const c = cam.current;
          const tx = (meK?.x ?? KT.W / 2) - VW / 2;
          const ty = (meK?.y ?? KT.H / 2) - VH / 2;
          if (!c.init) {
            c.x = tx;
            c.y = ty;
            c.init = true;
          }
          c.x += (tx - c.x) * Math.min(1, d.dt * 8);
          c.y += (ty - c.y) * Math.min(1, d.dt * 8);
          ctx.fillStyle = '#69c45a';
          ctx.fillRect(0, 0, VW, VH);
          ctx.save();
          ctx.translate(-c.x, -c.y);
          // grass texture
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          const gx0 = Math.floor(c.x / 120) * 120;
          const gy0 = Math.floor(c.y / 120) * 120;
          for (let x = gx0; x < c.x + VW + 120; x += 120) for (let y = gy0 + ((x / 120) % 2) * 60; y < c.y + VH + 120; y += 120) ctx.fillRect(x, y, 60, 60);
          if (track) drawTrack(ctx, track);
          for (const p of s.p) {
            const m = player(p.id);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.a);
            if (p.bo) {
              ctx.fillStyle = 'rgba(255,170,40,0.8)';
              ctx.beginPath();
              ctx.moveTo(-26, -10);
              ctx.lineTo(-56 - Math.random() * 14, 0);
              ctx.lineTo(-26, 10);
              ctx.fill();
            }
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            roundRect(ctx, -24, -14, 52, 34, 10);
            ctx.fill();
            ctx.fillStyle = color(p.id);
            roundRect(ctx, -26, -17, 52, 34, 10);
            ctx.fill();
            ctx.fillStyle = '#1d1442';
            for (const [wx, wy] of [[-16, -19], [12, -19], [-16, 15], [12, 15]]) ctx.fillRect(wx, wy, 12, 5);
            ctx.restore();
            drawBloop(ctx, p.x, p.y - 4, 15, m?.avatar, { name: m?.name, me: p.id === me, mood: p.sp ? 'shock' : p.bo ? 'happy' : undefined });
            if (p.f) text(ctx, `🏁 ${ordinal(p.pl)}`, p.x, p.y - 52, 22, '#ffd23f');
          }
          for (const f of d.latest.fx as Pub['fx']) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            text(ctx, f.k === 'boost' ? '💨' : f.k === 'spin' ? '💫' : '💥', f.x, f.y - age * 30, 34);
          }
          ctx.restore();
          // minimap
          if (track) {
            const mw = 170;
            const mh = (mw * KT.H) / KT.W;
            const mx = VW - mw - 14;
            const my = VH - mh - 14;
            ctx.fillStyle = 'rgba(20,8,50,0.55)';
            roundRect(ctx, mx - 8, my - 8, mw + 16, mh + 16, 12);
            ctx.fill();
            ctx.beginPath();
            track.pts.forEach((p, i) => (i ? ctx.lineTo(mx + (p.x / KT.W) * mw, my + (p.y / KT.H) * mh) : ctx.moveTo(mx + (p.x / KT.W) * mw, my + (p.y / KT.H) * mh)));
            ctx.closePath();
            ctx.strokeStyle = '#d6ccff';
            ctx.lineWidth = 4;
            ctx.stroke();
            for (const p of s.p) {
              ctx.fillStyle = p.id === me ? '#ffd23f' : color(p.id);
              ctx.beginPath();
              ctx.arc(mx + (p.x / KT.W) * mw, my + (p.y / KT.H) * mh, p.id === me ? 6 : 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          if (d.t < s.t0) {
            const n = Math.ceil((s.t0 - d.t) / 1000);
            text(ctx, n > 0 ? `${n}` : 'GO!', VW / 2, VH / 2 - 60, 110, n > 0 ? '#fff' : '#34cf78');
          } else if (d.t - s.t0 < 700) text(ctx, 'GO!', VW / 2, VH / 2 - 60, 110, '#34cf78');
        }}
      />
      <div className="rc-hud">
        <div className="rc-col" style={{ alignItems: 'flex-start' }}>
          {mine && <span className="rc-pill big gold">{mine.f ? `🏁 ${ordinal(mine.pl)}` : `${ordinal(mine.pos)} / ${pub.p.length}`}</span>}
          {mine && !mine.f && <span className="rc-pill">Lap {mine.lap}/{KT.LAPS}</span>}
        </div>
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
