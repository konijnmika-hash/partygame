import './physics.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { applyView, fitWorld, roundRect, text } from '../../game/canvas';
import { serverNow } from '../../net/clock';
import { Avatar } from '../../components/ui';
import { Countdown, MiniScores, RankPill, useKeys } from '../../game/kit';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

const W = 800;
const H = 1000;
const BH = 44;
const GROUND = H - 80;
const COLORS = ['#ff4f5f', '#3da9fc', '#34cf78', '#ffb21f', '#a46bff', '#ff7ac8', '#2ad4c4', '#ff8a3d'];

interface Block { x: number; w: number; c: number; by: string | null }
interface Pub {
  phase: 'aim' | 'drop' | 'topple' | 'over';
  turn: number;
  total: number;
  current: string | null;
  deadline: number;
  hook: { t0: number; period: number; amp: number };
  nextW: number;
  nextC: number;
  tower: Block[];
  lean: number;
  leanDir: number;
  drop: { x: number; w: number; c: number; pid: string; at: number; kind: string; level: number } | null;
  last: { kind: 'place' | 'perfect' | 'miss' | 'topple'; x: number; pid: string; pts: number; at: number; level: number } | null;
  fall: { dir: number; level: number } | null;
  best: number;
  scores: Record<string, number>;
  order: string[];
}

function hookX(h: Pub['hook'], t: number): number {
  return h.amp * Math.sin((2 * Math.PI * (t - h.t0)) / h.period);
}

function drawBlock(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  roundRect(ctx, cx - w / 2, y, w, BH - 3, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, cx - w / 2 + 6, y + 5, w - 12, 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(cx - w / 2 + 4, y + BH - 12, w - 8, 6);
}

export default function WobblyTower({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const cam = useRef(0);
  const [toast, setToast] = useState<{ text: string; sub: string; color: string; key: number } | null>(null);
  const myTurn = isPlayer && pub.phase === 'aim' && pub.current === me;
  const sentTurn = useRef(-1);

  const drop = () => {
    if (!myTurn || sentTurn.current === pub.turn) return;
    sentTurn.current = pub.turn;
    sfx('whoosh');
    vibrate(15);
    send({ t: 'drop', at: serverNow() });
  };
  useKeys((k) => {
    if (k === ' ' || k === 'Enter') drop();
  }, myTurn);

  useEffect(() => {
    if (myTurn) sfx('ding');
  }, [myTurn, pub.turn]);

  useEffect(() => {
    const l = pub.last;
    if (!l) return;
    const who = l.pid === me ? 'You' : nm(players, l.pid);
    if (l.kind === 'topple') {
      sfx('boom');
      vibrate([100, 50, 150]);
      setToast({ text: '💥 TIMBER!', sub: `${who} toppled the tower (${l.pts})`, color: '#ff8a8f', key: l.at });
    } else if (l.kind === 'miss') {
      sfx('wrong');
      setToast({ text: 'Missed!', sub: `${who} ${l.pts}`, color: '#ff8a8f', key: l.at });
    } else if (l.kind === 'perfect') {
      sfx('correct');
      setToast({ text: '✨ PERFECT!', sub: `${who} +${l.pts}`, color: '#ffd23f', key: l.at });
    } else {
      sfx('tap');
      setToast({ text: `+${l.pts}`, sub: who, color: '#fff', key: l.at });
    }
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [pub.last?.at]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    const frame = (nowP: number) => {
      const dt = Math.min(0.1, (nowP - last) / 1000);
      last = nowP;
      const p = pubRef.current;
      const now = serverNow();
      const view = fitWorld(cv, W, H, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      applyView(ctx, view);
      const height = p.tower.length;
      const topY = GROUND - height * BH;
      // keep the top of the tower a bit above the middle of the screen
      const want = Math.max(0, H * 0.45 - topY);
      cam.current += (want - cam.current) * Math.min(1, dt * 3);
      const camY = cam.current;
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#7fd3ff');
      g.addColorStop(1, '#e7f8ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, camY);
      // ground
      ctx.fillStyle = '#5bd15b';
      ctx.fillRect(-W, GROUND, W * 2, 400);
      ctx.fillStyle = '#3fae4c';
      ctx.fillRect(-W, GROUND, W * 2, 10);
      // tower with a little sway proportional to how badly it leans
      const sway = p.phase === 'topple' ? 0 : p.lean * 0.035 * Math.sin(nowP / 260) + p.leanDir * p.lean * 0.012;
      const fallK = p.phase === 'topple' && p.fall ? Math.min(1, (now - (p.last?.at ?? now)) / 1400) : 0;
      p.tower.forEach((b, i) => {
        const y = GROUND - (i + 1) * BH;
        ctx.save();
        if (p.fall && p.phase === 'topple' && i > p.fall.level) {
          // rotate the falling part around the edge of the supporting block
          const sup = p.tower[p.fall.level];
          const px = sup.x + (p.fall.dir * sup.w) / 2;
          const py = GROUND - (p.fall.level + 1) * BH;
          ctx.translate(px, py);
          ctx.rotate(p.fall.dir * fallK * fallK * 1.9);
          ctx.translate(-px, -py + fallK * fallK * 260);
        } else if (i > 0) {
          ctx.translate(0, GROUND);
          ctx.rotate(sway * (i / Math.max(1, height)));
          ctx.translate(0, -GROUND);
        }
        drawBlock(ctx, b.x, y, b.w, i === 0 ? '#6b55c9' : COLORS[b.c % COLORS.length]);
        if (i === 0) text(ctx, 'BASE', b.x, y + BH / 2 - 2, 20, '#fff');
        ctx.restore();
      });
      // crane + swinging block
      const hookY = topY - BH * 4.2;
      if (p.phase === 'aim') {
        const hx = hookX(p.hook, now);
        ctx.strokeStyle = '#3b2e6e';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-W, hookY - 150);
        ctx.lineTo(W, hookY - 150);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hx, hookY - 150);
        ctx.lineTo(hx, hookY);
        ctx.stroke();
        ctx.fillStyle = '#3b2e6e';
        ctx.fillRect(hx - 18, hookY - 158, 36, 16);
        drawBlock(ctx, hx, hookY, p.nextW, COLORS[p.nextC % COLORS.length]);
        const cur = p.current ? player(p.current) : null;
        if (cur) text(ctx, cur.name, hx, hookY - 24, 22, p.current === me ? '#ffd23f' : '#fff');
        // landing guide
        ctx.strokeStyle = 'rgba(29,20,66,0.25)';
        ctx.setLineDash([8, 10]);
        ctx.beginPath();
        ctx.moveTo(hx, hookY + BH);
        ctx.lineTo(hx, topY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p.drop && p.phase === 'drop') {
        const k = Math.min(1, (now - p.drop.at) / 800);
        const landY = topY - BH;
        const missFall = p.drop.kind === 'miss' ? k * k * 900 : 0;
        const y = hookY + (landY - hookY) * Math.min(1, k * k * 1.6) + missFall;
        ctx.save();
        if (p.drop.kind === 'miss') {
          ctx.translate(p.drop.x, y);
          ctx.rotate((p.drop.x > (p.tower[p.tower.length - 1]?.x ?? 0) ? 1 : -1) * k * 1.4);
          ctx.translate(-p.drop.x, -y);
        }
        drawBlock(ctx, p.drop.x, y, p.drop.w, COLORS[p.drop.c % COLORS.length]);
        ctx.restore();
      }
      ctx.restore();
      if (p.lean > 0.75 && p.phase !== 'topple') text(ctx, '⚠️ Wobbly!', W / 2, H - 40, 34, '#ff5a5f');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cur = pub.current ? player(pub.current) : null;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <div className="wt-stage arena-wrap" onPointerDown={() => drop()}>
        <canvas ref={ref} className="arena-canvas" />
      </div>
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
          <span className="ph-pill">Turn {Math.min(pub.total, pub.turn + 1)}/{pub.total}</span>
          <span className="ph-pill">🏗️ {Math.max(0, pub.tower.length - 1)} high · best {pub.best}</span>
        </div>
      </div>
      {toast && (
        <div key={toast.key} className="wt-toast" style={{ color: toast.color }}>
          {toast.text}
          <small>{toast.sub}</small>
        </div>
      )}
      {pub.phase === 'aim' && cur && (
        <div className={`wt-turn ${myTurn ? 'mine' : ''}`}>
          <Avatar avatar={cur.avatar} size={36} />
          <span>{myTurn ? 'Your turn — tap to drop!' : `${cur.name} is aiming...`}</span>
          <span style={{ width: 70 }}><Countdown deadline={pub.deadline} total={7000} /></span>
        </div>
      )}
    </div>
  );
}
