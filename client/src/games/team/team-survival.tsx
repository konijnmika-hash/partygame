import './team.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text, emoji } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { teamColor } from '@shared/teams';
import { TeamBar } from './_team';
import { sfx, vibrate } from '../../audio/sfx';

const W = 1000;
const H = 700;

interface Pub {
  t0: number;
  endsAt: number;
  teams: string[][];
  p: { id: string; x: number; y: number; dn: number; rv: number }[];
  o: { id: number; x: number; y: number }[];
  fx: { k: 'down' | 'up'; x: number; y: number; at: number }[];
  teamUp: number[];
}

export default function TeamSurvival({ pub, pubT, me, isPlayer, input, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string; by?: string };
    if (ev.type === 'down') {
      sfx(d.id === me ? 'hit' : 'pop');
      if (d.id === me) vibrate([120, 60, 120]);
    } else if (ev.type === 'revive') sfx(d.id === me || d.by === me ? 'levelup' : 'ding');
  }, false), [me]);
  const teamOfId = (id: string) => pub.teams.findIndex((m) => m.includes(id));
  const meP = pub.p.find((p) => p.id === me);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#251a4a';
          roundRect(ctx, 0, 0, W, H, 26);
          ctx.fill();
          ctx.fillStyle = 'rgba(122,240,168,0.06)';
          for (let i = 0; i < 14; i++) {
            ctx.beginPath();
            ctx.arc((i * 173) % W, (i * 97) % H, 50, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const p of s.p) {
            const m = player(p.id);
            const t = teamOfId(p.id);
            if (p.dn) {
              ctx.strokeStyle = 'rgba(255,255,255,0.25)';
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 75, 0, Math.PI * 2);
              ctx.stroke();
              if (p.rv > 0) {
                ctx.strokeStyle = '#7af0a8';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 40, -Math.PI / 2, -Math.PI / 2 + p.rv * Math.PI * 2);
                ctx.stroke();
              }
              drawBloop(ctx, p.x, p.y, 24, m?.avatar, { name: m?.name, me: p.id === me, alpha: 0.6, mood: 'sad', ring: teamColor(t) });
              text(ctx, '💤', p.x + 24, p.y - 30, 22);
            } else drawBloop(ctx, p.x, p.y, 25, m?.avatar, { name: m?.name, me: p.id === me, ring: teamColor(t) });
          }
          for (const o of s.o) {
            const wob = Math.sin(d.t / 120 + o.id) * 0.15;
            emoji(ctx, '👾', o.x, o.y, 58, wob);
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 800;
            if (age < 0 || age > 1) continue;
            text(ctx, f.k === 'up' ? '✨ Revived!' : '💥', f.x, f.y - 40 - age * 30, 26, f.k === 'up' ? '#7af0a8' : '#fff');
          }
          if (d.t < s.t0) text(ctx, 'Stick together!', W / 2, H / 2 - 40, 56, '#7af0a8');
        }}
      />
      <div className="ph-hud">
        <TeamBar teams={pub.teams} scores={pub.teamUp} me={me} fmt={(v) => `${v}s`} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {meP?.dn ? <div className="ph-pill" style={{ position: 'absolute', bottom: 'calc(170px + var(--safe-bottom))', left: '50%', transform: 'translateX(-50%)' }}>Knocked down — a teammate can revive you!</div> : null}
      {isPlayer && <TouchControls />}
    </div>
  );
}
