import './arcade.css';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { colorOf } from './_arcade';

const PEN = 150;
const PENS = [
  { x: 0, y: 0 },
  { x: 1000 - PEN, y: 700 - PEN },
  { x: 1000 - PEN, y: 0 },
  { x: 0, y: 700 - PEN },
];

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
          for (const sh of s.o) emoji(ctx, '🐑', sh.x, sh.y, 34, Math.sin(d.t / 300 + sh.id) * 0.08);
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
        <MiniScores players={players} scores={pub.scores} me={me} limit={4} title="Sheep" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v} 🐑`} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
