import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  pow: number;
  powHit: number;
  p: { id: string; x: number; y: number; f: number; st: number; inv: number; g: number }[];
  o: { id: number; x: number; y: number; k: number; d: number; fl: number; m: number }[];
  c: { id: number; x: number; y: number }[];
  bumps: { x: number; y: number; at: number }[];
  fx: { x: number; y: number; at: number; k: string }[];
  scores: Record<string, number>;
}

const PLATS = [
  { x0: 0, x1: 360, y: 430 },
  { x0: 640, x1: 1000, y: 430 },
  { x0: 240, x1: 760, y: 310 },
  { x0: 0, x1: 400, y: 190 },
  { x0: 600, x1: 1000, y: 190 },
];
const POW = { x: 500, y: 445, w: 46, h: 36 };

function pipe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mouthLeft: boolean) {
  ctx.fillStyle = '#2fae4f';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#4fd16a';
  ctx.fillRect(x + 6, y, 8, h);
  ctx.fillStyle = '#1e7a36';
  const mx = mouthLeft ? x - 10 : x + w - 8;
  ctx.fillRect(mx, y - 6, 18, h + 12);
}

export default function PipePanic({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; n?: number };
    if (ev.type === 'kick') sfx(d.id === me ? 'win' : 'pop', 1.3);
    if (ev.type === 'coin' && d.id === me) sfx('coin', 1.2);
    if (ev.type === 'bump' && d.id === me) sfx('tock');
    if (ev.type === 'jump' && d.id === me) sfx('jump');
    if (ev.type === 'pow') {
      sfx('boom', 0.8);
      vibrate(150);
    }
    if (ev.type === 'bonk' && d.id === me) {
      sfx('hit');
      vibrate(200);
    }
  }, false), [me]);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 600 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const L = d.latest as Pub;
          const shake = d.t - L.powHit < 300 ? Math.sin(d.t / 15) * 6 : 0;
          ctx.save();
          ctx.translate(0, shake);
          ctx.fillStyle = '#10102a';
          ctx.fillRect(0, -20, 1000, 640);
          // bricks floor
          ctx.fillStyle = '#c0582c';
          ctx.fillRect(0, 560, 1000, 40);
          ctx.strokeStyle = '#7a2e12';
          ctx.lineWidth = 2;
          for (let x = 0; x < 1000; x += 40) ctx.strokeRect(x + ((x / 40) % 2) * 0, 560, 40, 20);
          for (let x = 20; x < 1000; x += 40) ctx.strokeRect(x, 580, 40, 20);
          // ledges, bulging where they were just bonked
          for (const pf of PLATS) {
            ctx.fillStyle = '#3d7fdc';
            ctx.fillRect(pf.x0, pf.y, pf.x1 - pf.x0, 16);
            ctx.fillStyle = '#7fb6ff';
            ctx.fillRect(pf.x0, pf.y, pf.x1 - pf.x0, 4);
          }
          for (const b of L.bumps) {
            const k = 1 - (d.t - b.at) / 220;
            if (k <= 0) continue;
            ctx.fillStyle = '#7fb6ff';
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, 46, 14 * k, 0, Math.PI, 0);
            ctx.fill();
          }
          pipe(ctx, 0, 128, 70, 44, false);
          pipe(ctx, 930, 128, 70, 44, true);
          pipe(ctx, 0, 520, 50, 40, false);
          pipe(ctx, 950, 520, 50, 40, true);
          // POW block
          if (L.pow > 0) {
            const sq = L.pow / 3;
            ctx.fillStyle = '#3da9fc';
            roundRect(ctx, POW.x - POW.w / 2, POW.y - (POW.h * sq) / 2, POW.w, POW.h * sq, 6);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            text(ctx, 'POW', POW.x, POW.y, 15 * Math.max(0.6, sq), '#fff');
          }
          // critters
          for (const c of s.o) {
            const e = c.k === 1 ? '🦀' : '🐢';
            ctx.save();
            ctx.translate(c.x, c.y);
            if (c.fl) ctx.rotate(Math.PI + Math.sin(d.t / 80) * 0.15);
            else if (c.d < 0 && c.k === 0) ctx.scale(-1, 1);
            emoji(ctx, e, 0, 0, 38);
            ctx.restore();
            if (c.fl) text(ctx, String(c.fl), c.x, c.y - 30, 16, '#ffe45c');
            else if (c.m) text(ctx, '💢', c.x + 14, c.y - 22, 16);
          }
          for (const c of s.c) emoji(ctx, '🪙', c.x, c.y, 26);
          for (const p of s.p) {
            const m = player(p.id);
            const blink = p.inv && !p.st && Math.floor(d.t / 90) % 2 === 0;
            drawBloop(ctx, p.x, p.y, 20, m?.avatar, { name: m?.name, me: p.id === me, flip: p.f < 0, alpha: blink ? 0.45 : 1, mood: p.st ? 'shock' : undefined });
            if (p.st) emoji(ctx, '💫', p.x, p.y - 34, 22);
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 800;
            if (age >= 0 && age <= 1) text(ctx, f.k, f.x, f.y - 30 - age * 40, 22, f.k.startsWith('-') ? '#ff8a8a' : '#ffe45c');
          }
          ctx.restore();
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Points" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v} pts`} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          <span className="ph-pill">POW ×{pub.pow}</span>
        </div>
      </div>
      {isPlayer && <TouchControls a="JUMP" />}
    </div>
  );
}
