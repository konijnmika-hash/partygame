import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  wave: number;
  dots: number[];
  pel: number[];
  p: { id: string; x: number; y: number; d: number; pw: number; inv: number }[];
  o: { id: number; x: number; y: number; fr: number; h: number }[];
  fx: { x: number; y: number; at: number; k: string }[];
  scores: Record<string, number>;
}

const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.##-##.#.##.#',
  '#....#.#HHH#.#....#',
  '.....#.#HHH#.#.....',
  '#.##.#.#####.#.##.#',
  '#.................#',
  '#.##.###.#.###.##.#',
  '#o..#....#....#..o#',
  '#.#...#.....#...#.#',
  '###################',
];
const C = 50;
const COLS = 19;
const GHOST_COLORS = ['#ff4f5f', '#ff7ac8', '#2ad4c4', '#ffb21f'];

function drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number, scared: boolean) {
  const r = 19;
  ctx.fillStyle = scared ? (Math.floor(t / 200) % 2 ? '#3d5afe' : '#6c7dff') : color;
  ctx.beginPath();
  ctx.arc(x, y - 3, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r - 4);
  for (let i = 0; i < 4; i++) {
    const wx = x + r - ((i + 0.5) * (2 * r)) / 4;
    ctx.lineTo(wx, y + r - 4 - (i % 2 ? 0 : 7) - Math.sin(t / 90) * 2);
  }
  ctx.lineTo(x - r, y + r - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - 7, y - 5, 5, 0, Math.PI * 2);
  ctx.arc(x + 7, y - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  if (!scared) {
    ctx.fillStyle = '#1a1446';
    ctx.beginPath();
    ctx.arc(x - 6, y - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 8, y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function DotMuncher({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; by?: string };
    if (ev.type === 'power') sfx(d.id === me ? 'levelup' : 'whoosh', 1);
    if (ev.type === 'eatGhost' && d.id === me) sfx('win', 1.4);
    if (ev.type === 'caught') {
      if (d.id === me) {
        sfx('lose');
        vibrate(220);
      } else if (d.by === me) sfx('win', 1.2);
    }
    if (ev.type === 'wave') sfx('achievement');
  }, false), [me]);
  const mine = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 950, h: 650 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const L = d.latest as Pub;
          ctx.fillStyle = '#0b0b24';
          ctx.fillRect(0, 0, 950, 650);
          for (let r = 0; r < MAZE.length; r++) {
            for (let c = 0; c < COLS; c++) {
              const t = MAZE[r][c];
              if (t === '#') {
                ctx.fillStyle = '#1f2a8a';
                ctx.fillRect(c * C + 3, r * C + 3, C - 6, C - 6);
                ctx.strokeStyle = '#4f6bff';
                ctx.lineWidth = 2;
                ctx.strokeRect(c * C + 6, r * C + 6, C - 12, C - 12);
              } else if (t === '-') {
                ctx.fillStyle = '#ff9fd6';
                ctx.fillRect(c * C + 4, r * C + C / 2 - 3, C - 8, 6);
              }
            }
          }
          ctx.fillStyle = '#ffe2b8';
          for (const i of L.dots) {
            ctx.beginPath();
            ctx.arc((i % COLS) * C + C / 2, Math.floor(i / COLS) * C + C / 2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const i of L.pel) {
            ctx.beginPath();
            ctx.arc((i % COLS) * C + C / 2, Math.floor(i / COLS) * C + C / 2, 9 + Math.sin(d.t / 150) * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const g of s.o) drawGhost(ctx, g.x, g.y, GHOST_COLORS[(g.id - 1) % GHOST_COLORS.length], d.t, !!g.fr && !g.h);
          for (const p of s.p) {
            const m = player(p.id);
            const blink = p.inv && Math.floor(d.t / 90) % 2 === 0;
            const chomp = Math.abs(Math.sin(d.t / 70));
            if (p.pw) {
              ctx.fillStyle = 'rgba(255,228,92,0.3)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 18, m?.avatar, { name: m?.name, me: p.id === me, alpha: blink ? 0.4 : 1, flip: p.d === 2, squash: 1 + chomp * 0.08, mood: p.pw ? 'happy' : undefined, ring: p.pw ? '#ffe45c' : undefined });
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 800;
            if (age >= 0 && age <= 1) text(ctx, f.k, f.x, f.y - 24 - age * 30, 22, f.k.startsWith('-') ? '#ff8a8a' : '#ffe45c');
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Points" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v} pts`} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          <span className="ph-pill">Wave {pub.wave}</span>
          {mine && mine.pw ? <span className="ph-pill gold">⚡ POWER {mine.pw}s</span> : null}
        </div>
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
