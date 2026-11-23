import './racing.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, roundRect, text, emoji } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

const W = 1000;
const H = 700;

interface Pub {
  t0: number;
  holder: string | null;
  urgency: number;
  p: { id: string; x: number; y: number; o: number; oa: number }[];
  fx: { k: 'boom' | 'pass'; x: number; y: number; at: number }[];
  left: number;
}

export default function BombDodge({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  const urgency = useRef(0);
  urgency.current = pub.urgency;
  const holder = useRef<string | null>(null);
  holder.current = pub.holder;
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; to?: string };
    if (ev.type === 'boom') {
      sfx('boom');
      vibrate(d.id === me ? [200, 80, 200] : 80);
    } else if (ev.type === 'pass') {
      sfx('swap');
      if (d.to === me) vibrate(100);
    } else if (ev.type === 'bomb' && d.id === me) sfx('buzz');
  }, false), [me]);
  // ticking that speeds up as the fuse burns down
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!alive) return;
      if (holder.current) sfx(holder.current === me ? 'tock' : 'tick');
      t = setTimeout(loop, 700 - urgency.current * 560);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [me]);
  const iHold = pub.holder === me;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: W, h: H }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#3d2a6e';
          roundRect(ctx, 0, 0, W, H, 26);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (let x = 0; x < W; x += 100) for (let y = (x / 100) % 2 ? 0 : 100; y < H; y += 200) ctx.fillRect(x, y, 100, 100);
          ctx.strokeStyle = '#ff8a3d';
          ctx.lineWidth = 8;
          roundRect(ctx, 4, 4, W - 8, H - 8, 22);
          ctx.stroke();
          for (const f of s.fx) {
            const age = (d.t - f.at) / 900;
            if (age < 0 || age > 1) continue;
            if (f.k === 'boom') {
              ctx.fillStyle = `rgba(255,150,40,${0.8 * (1 - age)})`;
              ctx.beginPath();
              ctx.arc(f.x, f.y, 60 + age * 160, 0, Math.PI * 2);
              ctx.fill();
              text(ctx, 'BOOM!', f.x, f.y - 20 - age * 30, 56, '#fff');
            }
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.o) {
              const age = (d.t - p.oa) / 1200;
              if (age < 1) drawBloop(ctx, p.x, p.y - age * 60, 26, m?.avatar, { alpha: 1 - age, mood: 'shock' });
              continue;
            }
            const holds = s.holder === p.id;
            if (holds) {
              const flash = Math.floor(d.t / (240 - s.urgency * 180)) % 2 === 0;
              ctx.fillStyle = flash ? 'rgba(255,79,95,0.35)' : 'rgba(255,79,95,0.12)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 48, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 27, m?.avatar, { name: m?.name, me: p.id === me, mood: holds ? 'shock' : undefined });
            if (holds) {
              emoji(ctx, '💣', p.x + 24, p.y - 36, 36, Math.sin(d.t / 60) * 0.2);
              text(ctx, '✨', p.x + 40, p.y - 58 + Math.sin(d.t / 40) * 3, 18);
            }
          }
          if (d.t < s.t0) text(ctx, 'Don’t hold the bomb!', W / 2, H / 2 - 40, 52, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <span className="ph-pill">🧍 {pub.left} left</span>
        {pub.holder && <span className={`ph-pill ${iHold ? 'gold' : ''}`}>{iHold ? '💣 YOU have the bomb — tag someone!' : `💣 ${nm(players, pub.holder)}`}</span>}
      </div>
      {isPlayer && <TouchControls />}
    </div>
  );
}
