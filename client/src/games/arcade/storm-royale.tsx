import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  dropUntil: number;
  storm: { x: number; y: number; r: number };
  next: { x: number; y: number; r: number };
  shrinkAt: number;
  alive: number;
  p: { id: string; x: number; y: number; hp: number; sh: number; t: number; al: number; ax: number; ay: number; wr: number }[];
  o: { id: number; x: number; y: number; t: number }[];
  walls: { id: number; x: number; y: number; a: number; hp: number }[];
  loot: { id: number; x: number; y: number; k: 'chest' | 'shield' | 'med' }[];
  fx: { x: number; y: number; at: number; k: string }[];
  feed: { by: string; who: string; at: number }[];
  scores: Record<string, number>;
}

/** rarity colours: common, uncommon, rare, epic, legendary */
const RARITY = ['#b8bcc8', '#4fd16a', '#3da9fc', '#b05cff', '#ffb21f'];
const RARITY_NAME = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

function grass(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#58b368';
  roundRect(ctx, 0, 0, 1000, 700, 24);
  ctx.fill();
  // a few landmarks so the map has a sense of place
  ctx.fillStyle = '#4c9f5b';
  for (const [x, y, r] of [[160, 140, 70], [820, 560, 90], [520, 120, 50], [260, 560, 60], [860, 180, 55]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d9c38a';
  roundRect(ctx, 420, 300, 160, 100, 16);
  ctx.fill();
  ctx.fillStyle = '#5ea9e0';
  ctx.beginPath();
  ctx.ellipse(700, 330, 70, 40, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

export default function StormRoyale({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; by?: string; kind?: string };
    if (ev.type === 'elim') {
      sfx(d.by === me ? 'win' : 'boom', d.by === me ? 1.3 : 1);
      if (d.id === me) vibrate(300);
    }
    if (ev.type === 'loot' && d.id === me) sfx(d.kind === 'chest' ? 'achievement' : 'coin', 1.1);
    if (ev.type === 'build' && d.id === me) sfx('tock');
    if (ev.type === 'storm') sfx('whoosh', 0.7);
  }, false), [me]);
  const mine = pub.p.find((p) => p.id === me);
  const dead = mine && !mine.al;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 700 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const L = d.latest as Pub;
          grass(ctx);
          // loot
          for (const l of L.loot) {
            const bob = Math.sin(d.t / 250 + l.id) * 3;
            if (l.k === 'chest') {
              ctx.fillStyle = 'rgba(255,210,63,0.35)';
              ctx.beginPath();
              ctx.arc(l.x, l.y, 26 + Math.sin(d.t / 200) * 3, 0, Math.PI * 2);
              ctx.fill();
              emoji(ctx, '🧰', l.x, l.y + bob, 32);
            } else emoji(ctx, l.k === 'shield' ? '🧪' : '🩹', l.x, l.y + bob, 28);
          }
          // walls
          for (const w of L.walls) {
            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate(w.a);
            ctx.fillStyle = w.hp > 15 ? '#b07a45' : '#8a5a30';
            roundRect(ctx, -42, -8, 84, 16, 4);
            ctx.fill();
            ctx.strokeStyle = '#5a3a1c';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
          }
          // players
          for (const p of s.p) {
            const m = player(p.id);
            if (!p.al) {
              emoji(ctx, '🪦', p.x, p.y, 30);
              continue;
            }
            const dropping = d.t < L.dropUntil;
            if (dropping) emoji(ctx, '🪂', p.x, p.y - 46, 34);
            if (p.id === me) {
              ctx.strokeStyle = RARITY[p.t];
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(p.x + p.ax * 30, p.y + p.ay * 30);
              ctx.lineTo(p.x + p.ax * 64, p.y + p.ay * 64);
              ctx.stroke();
            }
            drawBloop(ctx, p.x, p.y, 22, m?.avatar, { name: m?.name, me: p.id === me, ring: RARITY[p.t] });
            // health + shield bars
            ctx.fillStyle = 'rgba(20,8,50,0.6)';
            ctx.fillRect(p.x - 26, p.y + 30, 52, 9);
            ctx.fillStyle = '#4fd16a';
            ctx.fillRect(p.x - 25, p.y + 31, 50 * (p.hp / 100), 3.5);
            ctx.fillStyle = '#3da9fc';
            ctx.fillRect(p.x - 25, p.y + 34.5, 50 * (p.sh / 50), 3.5);
          }
          for (const b of s.o) {
            ctx.fillStyle = RARITY[b.t];
            ctx.beginPath();
            ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 400;
            if (age < 0 || age > 1) continue;
            ctx.strokeStyle = f.k === 'h' ? `rgba(255,90,90,${1 - age})` : `rgba(255,230,160,${1 - age})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 6 + age * 14, 0, Math.PI * 2);
            ctx.stroke();
          }
          // the storm: purple everywhere outside the circle
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, 1000, 700);
          ctx.arc(s.storm.x, s.storm.y, Math.max(0, s.storm.r), 0, Math.PI * 2, true);
          ctx.fillStyle = 'rgba(120,40,200,0.45)';
          ctx.fill('evenodd');
          ctx.restore();
          ctx.strokeStyle = '#d07bff';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(s.storm.x, s.storm.y, Math.max(0, s.storm.r), 0, Math.PI * 2);
          ctx.stroke();
          if (L.next.r < s.storm.r - 2) {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.setLineDash([14, 10]);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(L.next.x, L.next.y, Math.max(1, L.next.r), 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // kill feed
          L.feed.slice(-3).forEach((f, i) => {
            text(ctx, f.by ? `${nm(players, f.by)} 💥 ${nm(players, f.who)}` : `🌀 storm got ${nm(players, f.who)}`, 990, 640 - i * 26, 18, '#fff', 'right', 700);
          });
          if (d.t < L.dropUntil) text(ctx, 'DROP IN!', 500, 80, 46, '#ffe45c');
          if (dead) text(ctx, `Eliminated · #${L.alive + 1}`, 500, 350, 44, '#ff8a8a');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Eliminations" />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          <span className="ph-pill">🧍 {pub.alive} left</span>
          {mine && mine.al ? <span className="ph-pill" style={{ background: RARITY[mine.t], color: '#1a0d33' }}>🔫 {RARITY_NAME[mine.t]}</span> : null}
          {mine && mine.al ? <span className="ph-pill">❤️ {mine.hp} · 🛡️ {mine.sh}</span> : null}
        </div>
      </div>
      {isPlayer && !dead && <TouchControls a="FIRE" b={mine && mine.wr > 0 ? '…' : 'BUILD'} />}
    </div>
  );
}
