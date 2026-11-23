import './physics.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { ballBalanceDef, gustAt, BB_HZ, BB_RING, type BBState, type BBWorld } from '@shared/ghosts/ballBalance';
import { drawBloop, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { isTouchDevice, readInput } from '../../game/input';
import { disableTilt, enableTilt, recalibrateTilt, tilt, tiltSupported } from '../../game/tilt';
import { MiniScores, RankPill } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

const V = 760;
const C = V / 2;

export default function BallBalance({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<GhostPub>) {
  const [tiltOn, setTiltOn] = useState(false);
  const wasAlive = useRef(true);
  const lastGust = useRef(0);
  useEffect(() => () => disableTilt(), []);
  const scores = Object.fromEntries(Object.entries(pub.p).map(([id, s]: [string, any]) => [id, s.pts]));
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <GhostCanvas<BBWorld, BBState>
        def={ballBalanceDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA={false}
        worldSize={() => ({ w: V, h: V })}
        draw={(ctx, d) => {
          const w = d.world;
          const s = d.me;
          const tick = d.tick;
          const r = s ? s.r : Math.max(w.rMin, w.r0 - (w.shrink * tick) / BB_HZ);
          // sky
          const bg = ctx.createRadialGradient(C, C, 40, C, C, V * 0.75);
          bg.addColorStop(0, '#5b3fd0');
          bg.addColorStop(1, '#1b0f3d');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, V, V);
          // the plate leans with the current tilt
          const inp = isPlayer ? readInput() : { x: 0, y: 0 };
          const lx = inp.x * 10;
          const ly = inp.y * 10;
          ctx.save();
          ctx.translate(C, C);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(lx * 1.6, 26 + ly * 1.6, r * 1.02, r * 1.02, 0, 0, Math.PI * 2);
          ctx.fill();
          const pg = ctx.createRadialGradient(-r * 0.35 - lx, -r * 0.35 - ly, r * 0.1, 0, 0, r);
          pg.addColorStop(0, '#ffffff');
          pg.addColorStop(0.7, '#d9e4ff');
          pg.addColorStop(1, '#9fb2ea');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 10;
          ctx.strokeStyle = '#7c8fd6';
          ctx.stroke();
          // golden ring
          ctx.beginPath();
          ctx.arc(0, 0, r * BB_RING, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,210,63,0.28)';
          ctx.fill();
          ctx.setLineDash([10, 8]);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ffb21f';
          ctx.stroke();
          ctx.setLineDash([]);
          // gust arrows
          const g = gustAt(w, tick);
          if (g) {
            const m = Math.hypot(g.dx, g.dy) || 1;
            const ang = Math.atan2(g.dy, g.dx);
            ctx.save();
            ctx.rotate(ang);
            ctx.globalAlpha = 0.55;
            for (let i = -2; i <= 2; i++) {
              const off = ((performance.now() / 4) % 160) - 80;
              text(ctx, '➜', -120 + off + i * 40, i * 70, 34 + m / 12, '#c9f2ff');
            }
            ctx.restore();
            if (tick - lastGust.current > 40) {
              lastGust.current = tick;
              sfx('whoosh');
            }
          }
          // ghosts of the others
          for (const o of d.others) {
            if (!o.s.a) continue;
            drawBloop(ctx, o.s.x, o.s.y, 18, player(o.id)?.avatar, { alpha: 0.3 });
          }
          if (s) {
            const prev = d.prev ?? s;
            const x = lerp(prev.x, s.x, d.alpha);
            const y = lerp(prev.y, s.y, d.alpha);
            if (s.alive) drawBloop(ctx, x, y, 24, player(me)?.avatar, { me: true, mood: Math.hypot(x, y) > r * 0.75 ? 'shock' : 'happy' });
            else drawBloop(ctx, x * 1.15, y * 1.15, 18, player(me)?.avatar, { alpha: 0.5, mood: 'sad' });
            if (wasAlive.current && !s.alive) {
              sfx('lose');
              vibrate(200);
            }
            wasAlive.current = s.alive;
          }
          ctx.restore();
          if (s) {
            text(ctx, `${s.pts} pts`, V - 24, V - 30, 34, '#ffd23f', 'right');
            text(ctx, `${(s.t / BB_HZ).toFixed(1)}s`, V - 24, V - 72, 28, '#fff', 'right');
            if (!s.alive) text(ctx, 'You fell off!', C, C - 40, 54, '#ff8a8f');
          }
          if (!d.started) text(ctx, 'Balance!', C, C - 120, 60, '#fff');
        }}
      />
      <div className="ph-hud" style={{ top: 56 }}>
        <MiniScores players={players} scores={scores} me={me} limit={4} />
        <RankPill scores={scores} me={me} />
      </div>
      {isPlayer && isTouchDevice() && tiltSupported() && (
        <div className="ph-tools">
          <button
            className={`ph-tool ${tiltOn ? 'on' : ''}`}
            onClick={async () => {
              if (tiltOn) {
                disableTilt();
                setTiltOn(false);
              } else setTiltOn(await enableTilt());
            }}
          >
            📱 {tiltOn ? 'Tilt on' : 'Use tilt'}
          </button>
          {tiltOn && <button className="ph-tool" onClick={() => recalibrateTilt()}>🎯 Level</button>}
        </div>
      )}
      {isPlayer && !(tiltOn && tilt.active) && <TouchControls />}
    </div>
  );
}
