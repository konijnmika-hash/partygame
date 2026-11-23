import './team.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { teamColor, teamName } from '@shared/teams';
import { TeamBar, myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

const C = 500;
const R = 470;

interface Pub {
  phase: 'kickoff' | 'play' | 'goal' | 'over';
  phaseEnds: number;
  endsAt: number;
  golden: boolean;
  goalAng: number[];
  mouth: number;
  teams: string[][];
  score: number[];
  lastGoal: { team: number; by: string | null; own: boolean } | null;
  p: { id: string; x: number; y: number; d: number }[];
  o: { id: string; x: number; y: number }[];
}

export default function BlobSoccer({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const mine = myTeam(pub.teams, me);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'goal') {
      const g = ev.data as { team: number };
      sfx(g.team === mine ? 'cheer' : 'boom');
      vibrate(80);
    } else if (ev.type === 'kick') sfx('hit');
    else if (ev.type === 'golden') sfx('countdown');
  }, false), [mine]);
  const teamOfId = (id: string) => pub.teams.findIndex((m) => m.includes(id));
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 1000 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#2e8b57';
          ctx.fillRect(0, 0, 1000, 1000);
          // pitch with stripes
          ctx.save();
          ctx.beginPath();
          ctx.arc(C, C, R, 0, Math.PI * 2);
          ctx.clip();
          for (let i = 0; i < 10; i++) {
            ctx.fillStyle = i % 2 ? '#4cbf6a' : '#45b062';
            ctx.fillRect(i * 100, 0, 100, 1000);
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(C, C, 90, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(C, C, R, 0, Math.PI * 2);
          ctx.stroke();
          // goals: coloured arcs on the rim
          s.goalAng.forEach((a, t) => {
            ctx.strokeStyle = teamColor(t)!;
            ctx.lineWidth = 26;
            ctx.beginPath();
            ctx.arc(C, C, R + 8, a - s.mouth / 2, a + s.mouth / 2);
            ctx.stroke();
            text(ctx, teamName(t), C + Math.cos(a) * (R - 60), C + Math.sin(a) * (R - 60), 26, teamColor(t));
          });
          for (const p of s.p) {
            const m = player(p.id);
            const t = teamOfId(p.id);
            if (p.d) {
              ctx.fillStyle = 'rgba(255,255,255,0.45)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 36, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me, ring: teamColor(t) });
          }
          for (const b of s.o) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(b.x + 4, b.y + 18, 20, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1d1442';
            for (const [ox, oy] of [[0, 0], [11, -9], [-11, -9], [-9, 11], [9, 11]]) {
              ctx.beginPath();
              ctx.arc(b.x + ox, b.y + oy, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          if (s.phase === 'kickoff') text(ctx, s.golden ? 'GOLDEN GOAL!' : 'Kick off!', C, C - 140, 56, '#fff');
          if (s.phase === 'goal' && s.lastGoal) {
            const g = s.lastGoal;
            text(ctx, g.own ? 'OWN GOAL! 🙈' : 'GOAL!!! ⚽', C, C - 150, 80, g.team >= 0 ? teamColor(g.team) : '#fff');
            if (g.by) text(ctx, `${nm(players, g.by)}`, C, C - 80, 34, '#fff');
          }
        }}
      />
      <div className="ph-hud">
        <TeamBar teams={pub.teams} scores={pub.score} me={me} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          {pub.golden && <span className="ph-pill gold">Golden goal!</span>}
        </div>
      </div>
      {isPlayer && <TouchControls a="KICK" />}
    </div>
  );
}
