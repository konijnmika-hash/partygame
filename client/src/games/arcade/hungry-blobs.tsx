import './arcade.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { colorOf } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

const WW = 1600;
const WH = 1100;
const VW = 1000;
const VH = 700;
const PEL = ['#ff4f5f', '#ffd23f', '#34cf78', '#3da9fc', '#a46bff', '#ff8a3d'];

interface Pub {
  endsAt: number;
  p: { id: string; x: number; y: number; m: number }[];
  pel: [number, number][];
  scores: Record<string, number>;
}

const radiusOf = (m: number) => Math.sqrt(m) * 5.4;

export default function HungryBlobs({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const cam = useRef({ x: WW / 2 - VW / 2, y: WH / 2 - VH / 2, z: 1 });
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { by: string; id: string };
    if (ev.type === 'gulp') {
      if (d.by === me) sfx('levelup');
      else if (d.id === me) {
        sfx('lose');
        vibrate([150, 60, 150]);
      } else sfx('pop', 0.7);
    }
  }, false), [me]);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: VW, h: VH }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const meB = s.p.find((p) => p.id === me) ?? s.p.reduce((a, b) => (b.m > a.m ? b : a), s.p[0]);
          // zoom out a little as you grow
          const z = meB ? Math.max(0.55, Math.min(1, 1.15 - radiusOf(meB.m) / 220)) : 1;
          const c = cam.current;
          c.z += (z - c.z) * Math.min(1, d.dt * 2);
          const tx = (meB?.x ?? WW / 2) - VW / 2 / c.z;
          const ty = (meB?.y ?? WH / 2) - VH / 2 / c.z;
          c.x += (tx - c.x) * Math.min(1, d.dt * 6);
          c.y += (ty - c.y) * Math.min(1, d.dt * 6);
          ctx.fillStyle = '#f4f0ff';
          ctx.fillRect(0, 0, VW, VH);
          ctx.save();
          ctx.scale(c.z, c.z);
          ctx.translate(-c.x, -c.y);
          ctx.strokeStyle = 'rgba(93,74,168,0.12)';
          ctx.lineWidth = 2;
          for (let x = 0; x <= WW; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, WH);
            ctx.stroke();
          }
          for (let y = 0; y <= WH; y += 80) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(WW, y);
            ctx.stroke();
          }
          ctx.strokeStyle = '#5d4aa8';
          ctx.lineWidth = 8;
          ctx.strokeRect(0, 0, WW, WH);
          (d.latest as Pub).pel.forEach(([x, y], k) => {
            ctx.fillStyle = PEL[k % PEL.length];
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
          });
          // smaller blobs on top so they stay visible
          [...s.p].sort((a, b) => b.m - a.m).forEach((p) => {
            const m = player(p.id);
            const r = radiusOf(p.m);
            ctx.fillStyle = `${colorOf(players, p.id)}55`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            drawBloop(ctx, p.x, p.y, r * 0.8, m?.avatar, { name: `${m?.name ?? ''} ${Math.round(p.m)}`, me: p.id === me });
          });
          ctx.restore();
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} title="Mass" />
        <RankPill scores={pub.scores} me={me} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
