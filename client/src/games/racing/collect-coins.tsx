import './racing.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text, emoji } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

const W = 1000;
const H = 700;

interface Pub {
  endsAt: number;
  p: { id: string; x: number; y: number; c: number; d: number; st: number; cd: number }[];
  o: { id: number; x: number; y: number; v: number }[];
  fx: { k: 'pick' | 'knock'; x: number; y: number; at: number; v: number }[];
  scores: Record<string, number>;
}

export default function CollectCoins({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const myCoins = useRef(0);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { victim: string; by: string };
    if (ev.type === 'knock') {
      sfx('hit');
      if (d.victim === me) vibrate(140);
    }
  }, false), [me]);
  useEffect(() => {
    const c = pub.scores[me] ?? 0;
    if (c > myCoins.current) sfx('coin', c - myCoins.current >= 5 ? 1.4 : 1);
    myCoins.current = c;
  }, [pub.scores[me]]);
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
          g.addColorStop(0, '#2fbf8f');
          g.addColorStop(1, '#16775a');
          ctx.fillStyle = g;
          roundRect(ctx, 0, 0, W, H, 26);
          ctx.fill();
          ctx.strokeStyle = '#ffd23f';
          ctx.lineWidth = 8;
          roundRect(ctx, 4, 4, W - 8, H - 8, 22);
          ctx.stroke();
          for (const c of s.o) {
            const bob = Math.sin(d.t / 200 + c.id) * 4;
            emoji(ctx, c.v >= 5 ? '💎' : '🪙', c.x, c.y + bob, c.v >= 5 ? 40 : 32);
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.d) {
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me, mood: p.st ? 'shock' : undefined });
            text(ctx, `🪙${p.c}`, p.x, p.y + 44, 18, '#ffd23f');
            if (p.st) text(ctx, '💫', p.x, p.y - 50, 26);
          }
          for (const f of (d.latest as Pub).fx) {
            const age = (d.t - f.at) / 600;
            if (age < 0 || age > 1) continue;
            text(ctx, f.k === 'pick' ? `+${f.v}` : `-${f.v}`, f.x, f.y - 20 - age * 40, 26, f.k === 'pick' ? '#ffd23f' : '#ff8a8f');
          }
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} fmt={(v) => `🪙${v}`} />
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {isPlayer && <TouchControls a="DASH" />}
    </div>
  );
}
