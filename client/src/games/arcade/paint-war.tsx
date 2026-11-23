import './arcade.css';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { colorOf } from './_arcade';

interface Pub {
  endsAt: number;
  cols: number;
  rows: number;
  grid: string;
  p: { id: string; x: number; y: number; i: number }[];
  scores: Record<string, number>;
}

const CELL = 25;

export default function PaintWar({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const palette: Record<number, string> = {};
  pub.p.forEach((p) => (palette[p.i] = colorOf(players, p.id, p.i)));
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 700 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const g = (d.latest as Pub).grid;
          ctx.fillStyle = '#f4f0ff';
          roundRect(ctx, 0, 0, 1000, 700, 22);
          ctx.fill();
          for (let k = 0; k < g.length; k++) {
            const v = parseInt(g[k], 36);
            if (!v) continue;
            ctx.fillStyle = palette[v] ?? '#999';
            ctx.fillRect((k % s.cols) * CELL, Math.floor(k / s.cols) * CELL, CELL + 0.5, CELL + 0.5);
          }
          // soft grid lines
          ctx.strokeStyle = 'rgba(29,20,66,0.05)';
          ctx.lineWidth = 1;
          for (let x = CELL; x < 1000; x += CELL * 4) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 700);
            ctx.stroke();
          }
          for (const p of s.p) {
            const m = player(p.id);
            drawBloop(ctx, p.x, p.y, 24, m?.avatar, { name: m?.name, me: p.id === me, ring: '#fff' });
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} fmt={(v) => `${v}%`} title="Coverage" />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `${v}%`} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls a="DASH" />}
    </div>
  );
}
