import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  g: string;
  it: [number, string][];
  p: { id: string; x: number; y: number; l: number; o: number; inv: number; b: number; rg: number }[];
  bombs: { id: number; c: number; r: number; t: number }[];
  fl: [number, number][];
  scores: Record<string, number>;
}

const C = 60;
const COLS = 15;
const ITEM: Record<string, string> = { b: '💣', f: '🔥', s: '👟' };

export default function BoomBlocks({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; by?: string };
    if (ev.type === 'boom') sfx('boom', 0.9 + Math.random() * 0.3);
    if (ev.type === 'drop' && d.id === me) sfx('tock');
    if (ev.type === 'item' && d.id === me) sfx('coin', 1.3);
    if (ev.type === 'hurt') {
      if (d.id === me) vibrate(250);
      if (d.by === me && d.id !== me) sfx('win', 1.2);
    }
  }, false), [me]);
  const mine = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 900, h: 660 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const L = d.latest as Pub;
          ctx.fillStyle = '#4c9f5b';
          ctx.fillRect(0, 0, 900, 660);
          for (let i = 0; i < L.g.length; i++) {
            const c = i % COLS;
            const r = Math.floor(i / COLS);
            const x = c * C;
            const y = r * C;
            const k = L.g[i];
            if (k === '0' && (c + r) % 2 === 0) {
              ctx.fillStyle = '#55ad65';
              ctx.fillRect(x, y, C, C);
            }
            if (k === '1') {
              ctx.fillStyle = '#5e6a7d';
              ctx.fillRect(x, y, C, C);
              ctx.fillStyle = '#7c8aa0';
              ctx.fillRect(x + 4, y + 4, C - 8, C - 14);
            } else if (k === '2') {
              ctx.fillStyle = '#b07a45';
              roundRect(ctx, x + 3, y + 3, C - 6, C - 6, 6);
              ctx.fill();
              ctx.strokeStyle = '#6e4622';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(x + 8, y + 8);
              ctx.lineTo(x + C - 8, y + C - 8);
              ctx.moveTo(x + C - 8, y + 8);
              ctx.lineTo(x + 8, y + C - 8);
              ctx.stroke();
            }
          }
          for (const [i, k] of L.it) emoji(ctx, ITEM[k] ?? '❔', (i % COLS) * C + C / 2, Math.floor(i / COLS) * C + C / 2 + Math.sin(d.t / 200 + i) * 3, 30);
          for (const b of L.bombs) {
            const pulse = 1 + Math.sin(d.t / (b.t < 800 ? 40 : 110)) * 0.08;
            ctx.save();
            ctx.translate(b.c * C + C / 2, b.r * C + C / 2);
            ctx.scale(pulse, pulse);
            emoji(ctx, '💣', 0, 0, 40);
            ctx.restore();
          }
          for (const [c, r] of L.fl) {
            ctx.fillStyle = 'rgba(255,150,40,0.85)';
            roundRect(ctx, c * C + 4, r * C + 4, C - 8, C - 8, 14);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,240,140,0.9)';
            roundRect(ctx, c * C + 16, r * C + 16, C - 32, C - 32, 8);
            ctx.fill();
          }
          for (const p of s.p) {
            if (p.o) continue;
            const m = player(p.id);
            const blink = p.inv && Math.floor(d.t / 90) % 2 === 0;
            drawBloop(ctx, p.x, p.y, 21, m?.avatar, { name: m?.name, me: p.id === me, alpha: blink ? 0.4 : 1 });
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('❤️'.repeat(Math.max(0, p.l)), p.x, p.y + 32);
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Blasts" />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          {mine && !mine.o && <span className="ph-pill">💣{mine.b} 🔥{mine.rg} {'❤️'.repeat(mine.l)}</span>}
          {mine && mine.o ? <span className="ph-pill">💀 out — watch the finish!</span> : null}
        </div>
      </div>
      {isPlayer && <TouchControls a="BOMB" />}
    </div>
  );
}
