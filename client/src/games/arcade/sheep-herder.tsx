import './arcade.css';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { RankPill, SecondsLeft } from '../../game/kit';
import { colorOf } from './_arcade';

const PEN = 150;
const PENS = [
  { x: 0, y: 0 },
  { x: 1000 - PEN, y: 700 - PEN },
  { x: 1000 - PEN, y: 0 },
  { x: 0, y: 700 - PEN },
];

/** A fluffy sheep that reads well on grass on every device (emoji rendering varies a lot). */
function drawSheep(ctx: CanvasRenderingContext2D, x: number, y: number, id: number, t: number) {
  const bob = Math.sin(t / 240 + id) * 1.4;
  const dir = id % 2 ? 1 : -1;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 17, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b3355';
  for (const lx of [-9, -4, 4, 9]) ctx.fillRect(x + lx - 1.5, y + 4, 3, 10);
  const puffs: [number, number, number][] = [[-9, -1, 8], [0, -6, 9], [9, -1, 8], [-5, 5, 8], [5, 5, 8]];
  const blob = () => {
    ctx.beginPath();
    for (const [px, py, r] of puffs) {
      ctx.moveTo(x + px + r, y + py + bob);
      ctx.arc(x + px, y + py + bob, r, 0, Math.PI * 2);
    }
  };
  ctx.strokeStyle = '#b8b0d6';
  ctx.lineWidth = 4;
  blob();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  blob();
  ctx.fill();
  ctx.fillStyle = '#3b3355';
  ctx.beginPath();
  ctx.ellipse(x + dir * 15, y - 3 + bob, 6.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + dir * 11, y - 10 + bob, 4, 2.2, dir * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + dir * 17, y - 5 + bob, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

interface Pub {
  endsAt: number;
  pens: number[];
  p: { id: string; x: number; y: number; pen: number }[];
  o: { id: number; x: number; y: number }[];
  scores: Record<string, number>;
}

export default function SheepHerder({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const myPen = pub.p.find((p) => p.id === me)?.pen;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 700 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#7fd46b';
          roundRect(ctx, 0, 0, 1000, 700, 24);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          for (let i = 0; i < 30; i++) ctx.fillRect((i * 173) % 1000, (i * 97) % 700, 6, 14);
          s.p.forEach((p, k) => {
            const pen = PENS[p.pen];
            const col = colorOf(players, p.id, k);
            ctx.fillStyle = `${col}44`;
            ctx.fillRect(pen.x, pen.y, PEN, PEN);
            ctx.strokeStyle = col;
            ctx.lineWidth = 8;
            ctx.setLineDash([16, 10]);
            ctx.strokeRect(pen.x + 4, pen.y + 4, PEN - 8, PEN - 8);
            ctx.setLineDash([]);
            text(ctx, `${s.scores[p.id] ?? 0} 🐑`, pen.x + PEN / 2, pen.y + (pen.y ? 22 : PEN - 18), 22, '#fff');
          });
          for (const sh of s.o) drawSheep(ctx, sh.x, sh.y, sh.id, d.t);
          for (const p of s.p) {
            const m = player(p.id);
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me });
          }
          if (myPen != null) {
            const pen = PENS[myPen];
            text(ctx, 'YOUR PEN', pen.x + PEN / 2, pen.y + PEN / 2, 20, '#fff');
          }
        }}
      />
      <div className="ph-hud">
        {/* the pens already show everyone's count, so only your rank is shown here */}
        <span className="rp-always"><RankPill scores={pub.scores} me={me} fmt={(v) => `${v} 🐑`} /></span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
