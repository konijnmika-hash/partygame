import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents, toast } from '../../state/store';
import { serverNow } from '../../net/clock';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

// everyone (crowd and players) is drawn with the same look
const CROWD = { color: 'c-sky', eyes: 'e-round', mouth: 'm-smile', hat: 'h-none', acc: 'a-none' };

interface Pub {
  t0: number;
  endsAt: number;
  p: { id: string; x: number; y: number; st: number; rv: number }[];
  gems: [number, number][];
  fx: { k: 'hit' | 'oops' | 'gem'; x: number; y: number; at: number }[];
  scores: Record<string, number>;
}

export default function BlendIn({ pub, pubT, priv, me, isPlayer, input, players }: GameViewProps<Pub, { me: string | null; cd: number }>) {
  useInputStream(input, isPlayer);
  const myKey = priv?.me;
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { by: string; id?: string };
    if (ev.type === 'caught') {
      if (d.by === me) {
        sfx('cheer');
        toast(`🎯 You spotted ${nm(players, d.id)}!`, 'success');
      } else if (d.id === me) {
        sfx('lose');
        vibrate([120, 60, 120]);
        toast(`😱 ${nm(players, d.by)} spotted you!`, 'error');
      } else sfx('pop');
    } else if (ev.type === 'oops' && d.by === me) {
      sfx('wrong');
      toast('Oops — that was a crowd Bloop! Stunned…', 'error');
    }
  }, false), [me]);
  const cooling = priv ? serverNow() - priv.cd < 2500 : false;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 700 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#e9f7e4';
          roundRect(ctx, 0, 0, 1000, 700, 24);
          ctx.fill();
          ctx.fillStyle = 'rgba(46,139,87,0.08)';
          for (let i = 0; i < 24; i++) ctx.fillRect((i * 131) % 1000, (i * 89) % 700, 40, 40);
          for (const [x, y] of (d.latest as Pub).gems) emoji(ctx, '💎', x, y, 26, Math.sin(d.t / 250 + x) * 0.2);
          for (const m of s.p) {
            const mine = m.id === myKey;
            if (mine) {
              ctx.strokeStyle = 'rgba(255,210,63,0.9)';
              ctx.lineWidth = 3;
              ctx.setLineDash([6, 6]);
              ctx.beginPath();
              ctx.arc(m.x, m.y, 72, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            drawBloop(ctx, m.x, m.y, 22, CROWD, { me: mine, mood: m.st ? 'shock' : undefined });
            if (m.rv) text(ctx, '❗', m.x, m.y - 42, 26, '#ff5a5f');
            if (m.st) text(ctx, '💫', m.x + 18, m.y - 30, 20);
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 900;
            if (age < 0 || age > 1 || f.k === 'gem') continue;
            text(ctx, f.k === 'hit' ? '🎯 GOTCHA!' : '❌ OOPS!', f.x, f.y - 50 - age * 30, 26, f.k === 'hit' ? '#1fb562' : '#e8304a');
          }
          if (d.t < s.t0) text(ctx, 'Act natural… 👀', 500, 330, 52, '#2e8b57');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SecondsLeft deadline={pub.endsAt} />
          <span className="ph-pill">{cooling ? '⏳ strike recharging' : '🎯 strike ready'}</span>
        </div>
      </div>
      {isPlayer && <TouchControls a="STRIKE" />}
    </div>
  );
}
