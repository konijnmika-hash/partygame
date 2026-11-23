import './arcade.css';
import { useMemo, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, type GhostPub } from '../../game/GhostCanvas';
import { hopperDef, laneObjX, RH, type RHState, type RHWorld } from '@shared/ghosts/arcade';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { isTouchDevice } from '../../game/input';
import { pulseA, pulseDir, tapOrSwipe } from './_arcade';
import { sfx, vibrate } from '../../audio/sfx';

const C = RH.CELL;
const W = RH.COLS * C;
const CARS = ['#ff4f5f', '#3da9fc', '#ffd23f', '#a46bff', '#34cf78', '#ff8a3d'];

export default function RoadHopper({ pub, priv, me, isPlayer, send, player }: GameViewProps<GhostPub>) {
  const disp = useRef<{ c: number; r: number } | null>(null);
  const last = useRef({ x: 0, deaths: 0, at: 0 });
  const touch = isTouchDevice();
  const ts = useMemo(() => tapOrSwipe(() => pulseA(), (dx, dy) => pulseDir(dx, dy)), []);
  return (
    <div className="g-stage full" style={{ position: 'relative', touchAction: 'none' }} {...(isPlayer ? ts : {})}>
      <GhostCanvas<RHWorld, RHState>
        def={hopperDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA={false}
        worldSize={(w) => ({ w: W, h: w.lanes.length * C + 50 })}
        draw={(ctx, d) => {
          const w = d.world;
          const L = w.lanes.length;
          const rt = Math.max(0, d.tick - 1 + d.alpha);
          const rowY = (r: number) => 50 + (L - 1 - r) * C;
          ctx.fillStyle = '#2b1d5e';
          ctx.fillRect(0, 0, W, 50);
          w.lanes.forEach((lane, r) => {
            const y = rowY(r);
            if (lane.kind === 'grass') {
              ctx.fillStyle = r === L - 1 ? '#5fc35a' : '#7fd46b';
              ctx.fillRect(0, y, W, C);
              ctx.fillStyle = 'rgba(255,255,255,0.18)';
              for (let k = 0; k < 14; k++) ctx.fillRect(((k * 97 + r * 31) % W), y + ((k * 23) % (C - 12)) + 4, 4, 10);
              if (r === L - 1) {
                for (let k = 0; k < RH.COLS * 2; k++) {
                  ctx.fillStyle = k % 2 ? '#fff' : '#2b1d5e';
                  ctx.fillRect(k * (C / 2), y, C / 2, 8);
                }
                text(ctx, 'GOAL 🏁', W / 2, y + C / 2 + 4, 26, '#fff');
              }
              if (r === 0) text(ctx, 'START', W / 2, y + C / 2, 18, 'rgba(255,255,255,0.75)');
            } else if (lane.kind === 'road') {
              ctx.fillStyle = '#4b4860';
              ctx.fillRect(0, y, W, C);
              if (w.lanes[r + 1]?.kind === 'road') {
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                for (let x = 10; x < W; x += 48) ctx.fillRect(x, y - 2, 24, 4);
              }
            } else {
              ctx.fillStyle = '#3d9df2';
              ctx.fillRect(0, y, W, C);
              ctx.strokeStyle = 'rgba(255,255,255,0.35)';
              ctx.lineWidth = 2;
              for (let x = -40; x < W + 40; x += 60) {
                const ox = ((rt * 2 * lane.dir) % 60) + x;
                ctx.beginPath();
                ctx.moveTo(ox, y + C / 2);
                ctx.quadraticCurveTo(ox + 15, y + C / 2 - 6, ox + 30, y + C / 2);
                ctx.stroke();
              }
            }
            lane.objs.forEach((o, k) => {
              const x = laneObjX(lane, o, rt) * C;
              if (x > W || x + o.len * C < 0) return;
              if (lane.kind === 'road') {
                ctx.fillStyle = CARS[(k + r) % CARS.length];
                roundRect(ctx, x + 4, y + 9, o.len * C - 8, C - 18, 12);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                const fx = lane.dir > 0 ? x + o.len * C - 26 : x + 10;
                roundRect(ctx, fx, y + 15, 16, C - 30, 5);
                ctx.fill();
                ctx.fillStyle = '#20183d';
                for (const wx of [x + 14, x + o.len * C - 22]) {
                  ctx.fillRect(wx, y + 5, 10, 6);
                  ctx.fillRect(wx, y + C - 11, 10, 6);
                }
              } else if (lane.kind === 'river') {
                ctx.fillStyle = '#8b5a2b';
                roundRect(ctx, x + 3, y + 7, o.len * C - 6, C - 14, 16);
                ctx.fill();
                ctx.strokeStyle = '#6b3f17';
                ctx.lineWidth = 3;
                for (let q = 1; q < o.len; q++) {
                  ctx.beginPath();
                  ctx.moveTo(x + q * C, y + 12);
                  ctx.lineTo(x + q * C, y + C - 12);
                  ctx.stroke();
                }
              }
            });
          });
          // other players as ghosts
          for (const o of d.others) {
            if (o.s.d) continue;
            drawBloop(ctx, o.s.c * C + C / 2, rowY(o.s.r) + C / 2, 18, player(o.id)?.avatar, { alpha: 0.35 });
          }
          const s = d.me;
          if (s) {
            const tgt = { c: s.col, r: s.row };
            const cur = disp.current;
            if (!cur || Math.abs(cur.r - tgt.r) > 1.5 || Math.abs(cur.c - tgt.c) > 1.5) disp.current = { ...tgt };
            else {
              const k = Math.min(1, d.dt * 22);
              cur.c += (tgt.c - cur.c) * k;
              cur.r += (tgt.r - cur.r) * k;
            }
            const p = disp.current!;
            const hop = Math.max(0, Math.min(1, (d.tick + d.alpha - s.at) / 4));
            const lift = s.dead ? 0 : Math.sin(hop * Math.PI) * 12;
            const x = p.c * C + C / 2;
            const y = rowY(p.r) + C / 2 - lift;
            if (s.dead) {
              const lane = w.lanes[s.row];
              emoji(ctx, lane?.kind === 'river' ? '💦' : '💥', x, y, 46);
              drawBloop(ctx, x, y, 20, player(me)?.avatar, { me: true, alpha: 0.45, mood: 'shock', squash: 0.6 });
            } else drawBloop(ctx, x, y, 22, player(me)?.avatar, { me: true, mood: hop < 1 ? 'happy' : 'normal' });
            if (s.crossings > last.current.x) {
              sfx('win');
              vibrate([30, 40, 30]);
            }
            if (s.deaths > last.current.deaths) {
              sfx(w.lanes[s.row]?.kind === 'river' ? 'splash' : 'hit');
              vibrate(160);
            }
            if (s.at !== last.current.at) sfx('tap', 1.5);
            last.current = { x: s.crossings, deaths: s.deaths, at: s.at };
            text(ctx, `🏁 ${s.crossings} crossing${s.crossings === 1 ? '' : 's'}`, 14, 26, 24, '#fff', 'left');
          }
          const left = Math.max(0, Math.ceil(((hopperDef.maxTicks ?? 0) - d.tick) / RH.HZ));
          text(ctx, `⏱ ${left}s`, W - 14, 26, 24, left <= 10 ? '#ff8a8f' : '#fff', 'right');
          if (!d.started) text(ctx, touch ? 'Tap = hop · swipe = sideways' : 'Arrows / WASD to hop', W / 2, rowY(0) - 40, 26, '#fff');
        }}
      />
    </div>
  );
}
