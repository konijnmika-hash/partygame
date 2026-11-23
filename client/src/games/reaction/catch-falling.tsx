import './reaction.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const EMO: Record<string, string> = { apple: '🍎', banana: '🍌', cherry: '🍒', gold: '🌟', bomb: '💣' };

interface Pub {
  endsAt: number;
  p: { id: string; x: number; st: number; sc: number }[];
  o: { id: number; x: number; y: number; k: string }[];
  fx: { x: number; k: string; pid: string; at: number }[];
}

export default function CatchFalling({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const lastFx = useRef(0);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'boom') {
      sfx('boom');
      vibrate([60, 40, 60]);
    }
  }, false), []);
  useEffect(() => {
    for (const f of pub.fx) {
      if (f.at > lastFx.current && f.pid === me && f.k !== 'bomb') sfx('coin', f.k === 'gold' ? 1.3 : 1);
    }
    lastFx.current = Math.max(lastFx.current, ...pub.fx.map((f) => f.at), 0);
  }, [pub.fx]);
  const scores = Object.fromEntries(pub.p.map((p) => [p.id, p.sc]));
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1000, h: 600 }}
        draw={(ctx, d) => {
          const g = ctx.createLinearGradient(0, 0, 0, 600);
          g.addColorStop(0, '#8fd3ff');
          g.addColorStop(1, '#e6f7ff');
          ctx.fillStyle = g;
          roundRect(ctx, 0, 0, 1000, 600, 24);
          ctx.fill();
          ctx.fillStyle = '#5bd15b';
          ctx.fillRect(0, 548, 1000, 52);
          ctx.fillStyle = '#3fae4c';
          ctx.fillRect(0, 548, 1000, 8);
          for (const o of d.s.o) emoji(ctx, EMO[o.k] ?? '❓', o.x, o.y, o.k === 'gold' ? 50 : 44, o.k === 'bomb' ? Math.sin(d.t / 120) * 0.2 : 0);
          for (const p of d.s.p) {
            const m = player(p.id);
            const mine = p.id === me;
            // basket
            ctx.fillStyle = '#c98a4b';
            roundRect(ctx, p.x - 58, 506, 116, 40, 14);
            ctx.fill();
            ctx.strokeStyle = '#8a5a2b';
            ctx.lineWidth = 4;
            ctx.stroke();
            drawBloop(ctx, p.x, 492, 26, m?.avatar, { name: m?.name, me: mine, mood: p.st ? 'shock' : undefined, alpha: p.st ? 0.6 : 1 });
            if (p.st) text(ctx, '💫', p.x, 440, 30);
          }
          for (const f of d.latest.fx) {
            const age = (d.t - f.at) / 700;
            if (age < 0 || age > 1) continue;
            text(ctx, f.k === 'bomb' ? '-3' : f.k === 'gold' ? '+5' : f.k === 'cherry' ? '+2' : '+1', f.x, 470 - age * 80, 30, f.k === 'bomb' ? '#ff5a5f' : '#fff');
          }
        }}
      />
      <div className="arena-hud">
        <MiniScores players={players} scores={scores} me={me} limit={5} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
