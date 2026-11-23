import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { colorOf } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  p: { id: string; x: number; y: number; f: number; pct: number; st: number; g: number; a: number; hs: number; inv: number; gr: number }[];
  fx: { x: number; y: number; at: number; k: string }[];
  scores: Record<string, number>;
}

const STAGE = { x0: 210, x1: 790, y: 430, y1: 490 };
const LEDGES = [
  { x0: 290, x1: 430, y: 310 },
  { x0: 570, x1: 710, y: 310 },
  { x0: 430, x1: 570, y: 195 },
];

/** damage colour: white -> yellow -> orange -> red as the percentage climbs */
function pctColor(p: number) {
  if (p < 40) return '#ffffff';
  if (p < 80) return '#ffe45c';
  if (p < 120) return '#ff9d3d';
  return '#ff4f5f';
}

function backdrop(ctx: CanvasRenderingContext2D, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, 600);
  g.addColorStop(0, '#1b1446');
  g.addColorStop(1, '#5a2a8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1000, 600);
  for (let i = 0; i < 40; i++) {
    const x = (i * 197) % 1000;
    const y = (i * 89) % 360;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t / 500 + i)})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // floating stage block
  ctx.fillStyle = '#3a2f6b';
  ctx.beginPath();
  ctx.moveTo(STAGE.x0, STAGE.y);
  ctx.lineTo(STAGE.x1, STAGE.y);
  ctx.lineTo(STAGE.x1 - 60, STAGE.y1 + 50);
  ctx.lineTo(STAGE.x0 + 60, STAGE.y1 + 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8fd3ff';
  roundRect(ctx, STAGE.x0, STAGE.y - 6, STAGE.x1 - STAGE.x0, 14, 6);
  ctx.fill();
  for (const l of LEDGES) {
    ctx.fillStyle = 'rgba(143,211,255,0.85)';
    roundRect(ctx, l.x0, l.y - 4, l.x1 - l.x0, 9, 4);
    ctx.fill();
  }
}

export default function KnockoutClash({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; by?: string; smash?: number; air?: number };
    if (ev.type === 'hit') {
      sfx(d.smash ? 'boom' : 'hit', d.smash ? 1 : 1.2);
      if (d.id === me) vibrate(d.smash ? 160 : 50);
    }
    if (ev.type === 'ko') {
      sfx(d.by === me ? 'win' : 'whoosh', 1);
      if (d.id === me) vibrate(300);
    }
    if (ev.type === 'jump' && d.id === me) sfx('jump', d.air ? 1.3 : 1);
    if (ev.type === 'swing' && d.id === me) sfx('whoosh', 2);
  }, false), [me]);
  const sorted = [...pub.p];
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 600 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          backdrop(ctx, d.t);
          for (const p of s.p) {
            if (p.g) continue;
            const m = player(p.id);
            const blink = p.inv && Math.floor(d.t / 90) % 2 === 0;
            if (p.a) {
              ctx.fillStyle = p.a === 3 ? 'rgba(255,120,60,0.75)' : 'rgba(255,255,255,0.65)';
              ctx.beginPath();
              if (p.a === 2) ctx.arc(p.x, p.y - 40, 30, 0, Math.PI * 2);
              else ctx.ellipse(p.x + p.f * (p.a === 3 ? 44 : 36), p.y - 2, p.a === 3 ? 36 : 28, 18, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 22, m?.avatar, { name: m?.name, me: p.id === me, flip: p.f < 0, alpha: blink ? 0.4 : 1, mood: p.hs ? 'shock' : p.a ? 'happy' : undefined });
            // off-screen pointer
          }
          for (const p of s.p) {
            if (p.g) continue;
            if (p.y < 0) {
              const x = Math.max(20, Math.min(980, p.x));
              ctx.fillStyle = colorOf(players, p.id);
              ctx.beginPath();
              ctx.moveTo(x, 6);
              ctx.lineTo(x - 10, 24);
              ctx.lineTo(x + 10, 24);
              ctx.fill();
            }
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 700;
            if (age < 0 || age > 1) continue;
            if (f.k === 'ko') {
              ctx.fillStyle = `rgba(255,240,180,${0.8 * (1 - age)})`;
              ctx.beginPath();
              ctx.arc(f.x, f.y, 40 + age * 160, 0, Math.PI * 2);
              ctx.fill();
              text(ctx, 'KO!', Math.max(80, Math.min(920, f.x)), Math.max(60, Math.min(540, f.y)), 60 + age * 20, '#ffe45c');
            } else {
              emoji(ctx, f.k === 'smash' ? '💥' : '✨', f.x, f.y - age * 20, f.k === 'smash' ? 44 : 28);
            }
          }
        }}
      />
      <div className="ph-hud">
        <span />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      <div className="kc-cards">
        {sorted.map((p) => {
          const m = player(p.id);
          return (
            <div key={p.id} className={`kc-card ${p.id === me ? 'me' : ''} ${p.st <= 0 ? 'out' : ''}`} style={{ borderColor: colorOf(players, p.id) }}>
              <div className="kc-name">{m?.name ?? '?'}</div>
              <div className="kc-pct" style={{ color: pctColor(p.pct) }}>{p.st > 0 ? `${p.pct}%` : 'OUT'}</div>
              <div className="kc-stocks">{'●'.repeat(Math.max(0, p.st))}</div>
            </div>
          );
        })}
      </div>
      {isPlayer && <TouchControls a="HIT" b="JUMP" />}
    </div>
  );
}
