import './racing.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { GhostCanvas, lerp, type GhostPub } from '../../game/GhostCanvas';
import { climbDef, platX, CL_W, CL_PW, type CLState, type CLWorld } from '@shared/ghosts/climb';
import { drawBloop, roundRect, text } from '../../game/canvas';
import { isTouchDevice, virtual } from '../../game/input';
import { disableTilt, enableTilt, recalibrateTilt, tiltSupported } from '../../game/tilt';
import { MiniScores, RankPill, SecondsLeft } from '../../game/kit';
import { sfx } from '../../audio/sfx';

const VH = 800;
const COLORS = ['#4ccf5e', '#4ccf5e', '#3da9fc', '#b0794a'];

export default function PlatformRace({ pub, priv, me, isPlayer, send, player, players }: GameViewProps<GhostPub>) {
  const camTop = useRef(-VH * 0.6);
  const lastLast = useRef(0);
  const lastFalls = useRef(0);
  const [tiltOn, setTiltOn] = useState(false);
  const holds = useRef(new Map<number, number>());
  useEffect(() => () => {
    disableTilt();
    virtual.active = false;
    virtual.x = 0;
  }, []);
  const applyHolds = () => {
    let x = 0;
    for (const v of holds.current.values()) x += v;
    virtual.x = Math.max(-1, Math.min(1, x));
    virtual.y = 0;
    virtual.active = holds.current.size > 0;
  };
  const scores = Object.fromEntries(Object.entries(pub.p).map(([id, s]: [string, any]) => [id, Math.round(s.b / 50)]));
  const endsAt = pub.t0 + (climbDef.maxTicks / climbDef.hz) * 1000;
  return (
    <div
      className="g-stage full"
      style={{ position: 'relative' }}
      onPointerDown={(e) => {
        if (!isPlayer || tiltOn || (e.target as HTMLElement).closest('button')) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        holds.current.set(e.pointerId, e.clientX < r.left + r.width / 2 ? -1 : 1);
        applyHolds();
      }}
      onPointerUp={(e) => {
        holds.current.delete(e.pointerId);
        applyHolds();
      }}
      onPointerCancel={(e) => {
        holds.current.delete(e.pointerId);
        applyHolds();
      }}
    >
      <GhostCanvas<CLWorld, CLState>
        def={climbDef}
        pub={pub}
        priv={priv}
        me={me}
        isPlayer={isPlayer}
        send={send}
        tapToA={false}
        worldSize={() => ({ w: CL_W, h: VH })}
        draw={(ctx, d) => {
          const w = d.world;
          const s = d.me;
          let px = CL_W / 2;
          let py = 0;
          if (s) {
            const p = d.prev ?? s;
            px = Math.abs(s.x - p.x) > CL_W / 2 ? s.x : lerp(p.x, s.x, d.alpha);
            py = Math.abs(s.y - p.y) > 300 ? s.y : lerp(p.y, s.y, d.alpha);
          } else if (d.others.length) py = Math.min(...d.others.map((o) => o.s.y));
          // camera only moves up (and back down after a rescue)
          const want = py - VH * 0.6;
          if (want < camTop.current || (s && s.rescue > 0)) camTop.current += (want - camTop.current) * Math.min(1, d.dt * 6);
          const top = camTop.current;
          const height = -top;
          const g = ctx.createLinearGradient(0, 0, 0, VH);
          const k = Math.min(1, height / 15000);
          g.addColorStop(0, `hsl(${205 - k * 60} 80% ${70 - k * 45}%)`);
          g.addColorStop(1, `hsl(${195 - k * 40} 85% ${85 - k * 40}%)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, CL_W, VH);
          // height marks
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          for (let m = Math.ceil(-top / 500) * 500; m < -top + VH + 500; m += 500) {
            const y = -m - top;
            if (y < 0 || y > VH) continue;
            ctx.fillRect(0, y, 18, 3);
            text(ctx, `${m / 50}m`, 24, y, 14, '#fff', 'left', 900);
          }
          ctx.save();
          ctx.translate(0, -top);
          for (let i = 0; i < w.plats.length; i++) {
            const p = w.plats[i];
            if (p.y > top + VH + 40) continue;
            if (p.y < top - 40) break;
            if (p.k === 3 && s && s.broken.includes(i)) continue;
            const x = platX(p, d.tick);
            ctx.fillStyle = COLORS[p.k];
            roundRect(ctx, x - CL_PW / 2, p.y, CL_PW, 14, 7);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(x - CL_PW / 2 + 6, p.y + 3, CL_PW - 12, 3);
            if (p.k === 1) {
              ctx.strokeStyle = '#ffd23f';
              ctx.lineWidth = 4;
              ctx.beginPath();
              for (let z = 0; z < 4; z++) ctx.lineTo(x + (z % 2 ? 8 : -8), p.y - 4 - z * 5);
              ctx.stroke();
            } else if (p.k === 3) {
              ctx.strokeStyle = 'rgba(60,30,10,0.6)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x - 8, p.y);
              ctx.lineTo(x - 2, p.y + 8);
              ctx.lineTo(x + 6, p.y + 3);
              ctx.stroke();
            }
          }
          for (const o of d.others) {
            if (o.s.y < top - 60 || o.s.y > top + VH + 60) continue;
            drawBloop(ctx, o.s.x, o.s.y - 20, 16, player(o.id)?.avatar, { alpha: 0.32, flip: o.s.fc < 0 });
          }
          if (s) {
            drawBloop(ctx, px, py - 22, 20, player(me)?.avatar, { me: true, flip: s.face < 0, mood: s.vy < -900 ? 'happy' : undefined });
            // wrap-around: show the part that pokes out on the other side
            if (px < 30) drawBloop(ctx, px + CL_W, py - 22, 20, player(me)?.avatar, { flip: s.face < 0 });
            else if (px > CL_W - 30) drawBloop(ctx, px - CL_W, py - 22, 20, player(me)?.avatar, { flip: s.face < 0 });
            if (s.rescue > 0) text(ctx, '☁️', px, py + 6, 64);
            if (s.last !== lastLast.current) {
              const plat = w.plats[s.last];
              sfx(plat?.k === 1 ? 'jump' : 'tap', plat?.k === 1 ? 1 : 1.2 + Math.min(0.6, height / 20000));
            }
            if (s.falls > lastFalls.current) sfx('lose');
            lastLast.current = s.last;
            lastFalls.current = s.falls;
          }
          ctx.restore();
          if (s) text(ctx, `${Math.round(s.best / 50)} m`, CL_W - 16, 34, 32, '#fff', 'right');
          if (!d.started) text(ctx, 'Bounce up!', CL_W / 2, VH * 0.4, 46, '#fff');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={scores} me={me} limit={4} title="Metres" fmt={(v) => `${v}`} />
        <RankPill scores={scores} me={me} fmt={(v) => `${v} m`} />
        <SecondsLeft deadline={endsAt} />
      </div>
      {isPlayer && isTouchDevice() && tiltSupported() && (
        <div className="ph-tools" style={{ bottom: 'calc(20px + var(--safe-bottom))' }}>
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
    </div>
  );
}
