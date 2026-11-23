import './weird.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, Countdown, MiniScores, RoundDots } from '../../game/kit';
import { serverNow } from '../../net/clock';
import { sfx, vibrate } from '../../audio/sfx';

type Kind = 'mash' | 'rub' | 'hold' | 'spin' | 'statue' | 'exact';
interface Pub {
  i: number;
  n: number;
  phase: 'intro' | 'go' | 'result';
  goAt: number;
  deadline: number;
  kind: Kind;
  target: number;
  seed: number;
  dur: number;
  lowerBetter: boolean;
  live: Record<string, number> | null;
  vals: Record<string, number> | null;
  ranks: Record<string, number> | null;
  scores: Record<string, number>;
}

const INFO: Record<Kind, { title: string; how: (t: number) => string }> = {
  mash: { title: '👊 MASH!', how: () => 'Tap the button as fast as you can!' },
  rub: { title: '🧽 Rub it!', how: () => 'Rub the pad back and forth like crazy' },
  hold: { title: '⏱️ Exactly four seconds', how: () => 'Press and hold, then let go after EXACTLY 4 seconds. No clock!' },
  spin: { title: '🌀 Spin!', how: () => 'Draw circles around the pad as fast as you can' },
  statue: { title: '🗿 Statue', how: () => 'Keep your finger on the glowing dot as it drifts' },
  exact: { title: '🔢 Exact taps', how: (t) => `Tap exactly ${t} times. Count in your head!` },
};

function fmt(kind: Kind, v: number): string {
  switch (kind) {
    case 'mash': return `${v} taps`;
    case 'rub': return `${v} rubs`;
    case 'hold': return `off by ${(v / 1000).toFixed(2)} s`;
    case 'spin': return `${v.toFixed(1)} spins`;
    case 'statue': return `${(v / 1000).toFixed(1)} s on the dot`;
    case 'exact': return v === 0 ? 'perfect!' : `off by ${v}`;
  }
}

function dotPos(seed: number, t: number) {
  return { x: 50 + 30 * Math.sin(t * 0.0011 + seed), y: 50 + 30 * Math.sin(t * 0.0015 + seed * 1.7) };
}

export default function SillyChallenge({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { mine: number | null; holding: boolean }>) {
  const go = pub.phase === 'go' && isPlayer;
  const pad = useRef<HTMLDivElement>(null);
  const acc = useRef({ rub: 0, axis: 0, sign: 0, travel: 0, lastX: 0, lastY: 0, angle: 0, total: 0, sentR: 0, down: false, inside: false });
  const [dot, setDot] = useState({ x: 50, y: 50, inside: false });
  useEffect(() => {
    acc.current = { rub: 0, axis: 0, sign: 0, travel: 0, lastX: 0, lastY: 0, angle: 0, total: 0, sentR: 0, down: false, inside: false };
    if (pub.phase === 'go') sfx('go');
    if (pub.phase === 'result') sfx(pub.ranks?.[me] === 1 ? 'win' : 'pop');
  }, [pub.phase, pub.i]);
  // batched senders for rub / spin / statue heartbeats
  useEffect(() => {
    if (!go) return;
    const iv = setInterval(() => {
      const a = acc.current;
      if (pub.kind === 'rub' && a.rub > 0) {
        send({ t: 'rub', n: Math.min(10, a.rub) });
        a.rub = 0;
      } else if (pub.kind === 'spin') {
        const r = Math.abs(a.total) / (Math.PI * 2);
        if (r - a.sentR > 0.05) {
          send({ t: 'spin', r: Math.round(r * 100) / 100 });
          a.sentR = r;
        }
      } else if (pub.kind === 'statue') {
        const t = serverNow() - pub.goAt;
        const p = dotPos(pub.seed, t);
        const el = pad.current;
        let inside = false;
        if (el && a.down) {
          const rect = el.getBoundingClientRect();
          const dx = ((a.lastX - rect.left) / rect.width) * 100 - p.x;
          const dy = ((a.lastY - rect.top) / rect.height) * 100 - p.y;
          inside = Math.hypot(dx, dy) < 13;
        }
        if (inside) send({ t: 'in', v: true });
        else if (a.inside) send({ t: 'in', v: false });
        a.inside = inside;
        setDot({ x: p.x, y: p.y, inside });
      }
    }, pub.kind === 'statue' ? 200 : 150);
    return () => clearInterval(iv);
  }, [go, pub.kind, pub.i]);
  // the statue dot keeps drifting even when we're not touching it
  useEffect(() => {
    if (pub.kind !== 'statue' || pub.phase !== 'go') return;
    let raf = 0;
    const f = () => {
      const p = dotPos(pub.seed, serverNow() - pub.goAt);
      setDot((d) => ({ ...d, x: p.x, y: p.y }));
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [pub.kind, pub.phase, pub.i]);

  const tap = () => {
    if (!go) return;
    vibrate(5);
    sfx('tap', 1.1);
    send({ t: 'tap' });
  };
  const onDown = (e: React.PointerEvent) => {
    if (!go) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const a = acc.current;
    a.down = true;
    a.lastX = e.clientX;
    a.lastY = e.clientY;
    if (pub.kind === 'spin' && pad.current) {
      const r = pad.current.getBoundingClientRect();
      a.angle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    }
  };
  const onMoveP = (e: React.PointerEvent) => {
    const a = acc.current;
    if (!go || !a.down) return;
    const dx = e.clientX - a.lastX;
    const dy = e.clientY - a.lastY;
    if (pub.kind === 'rub') {
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const sign = Math.sign(d);
      if (sign && sign !== a.sign) {
        if (a.travel >= 30) {
          a.rub++;
          sfx('draw');
        }
        a.sign = sign;
        a.travel = 0;
      }
      a.travel += Math.abs(d);
    } else if (pub.kind === 'spin' && pad.current) {
      const r = pad.current.getBoundingClientRect();
      const ang = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
      let da = ang - a.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      a.total += da;
      a.angle = ang;
    }
    a.lastX = e.clientX;
    a.lastY = e.clientY;
  };
  const onUp = () => {
    acc.current.down = false;
  };

  const info = pub.kind ? INFO[pub.kind] : null;
  const live = pub.live?.[me];
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.i} />
      {info && <Banner title={info.title} sub={info.how(pub.target)} big={pub.phase === 'intro'} />}
      {pub.phase === 'intro' && <div className="big-count">{Math.max(1, Math.ceil((pub.goAt - serverNow()) / 1000))}</div>}
      {pub.phase === 'go' && <Countdown deadline={pub.kind === 'hold' ? null : pub.deadline} total={pub.dur} />}
      {pub.phase === 'go' && (
        <>
          {(pub.kind === 'mash' || pub.kind === 'exact') && (
            <>
              {pub.kind === 'mash' && <div className="big-count">{live ?? 0}</div>}
              {pub.kind === 'exact' && <div className="big-count">🎯 {pub.target}</div>}
              <button className="silly-btn" onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={!isPlayer}>TAP</button>
            </>
          )}
          {pub.kind === 'hold' && (
            <button
              className="silly-btn"
              style={priv?.holding ? { filter: 'brightness(1.2)', transform: 'scale(0.96)' } : undefined}
              disabled={!isPlayer || priv?.mine != null}
              onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); sfx('select'); send({ t: 'down' }); }}
              onPointerUp={() => { sfx('ding'); send({ t: 'up' }); }}
              onPointerCancel={() => send({ t: 'up' })}
            >
              {priv?.mine != null ? '✓' : priv?.holding ? 'holding…' : 'HOLD'}
            </button>
          )}
          {(pub.kind === 'rub' || pub.kind === 'spin' || pub.kind === 'statue') && (
            <div ref={pad} className={`challenge-pad ${pub.kind === 'spin' ? 'round' : ''}`} onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUp} onPointerCancel={onUp}>
              {pub.kind === 'statue' ? <span className={`statue-dot ${dot.inside ? 'in' : ''}`} style={{ left: `${dot.x}%`, top: `${dot.y}%` }} /> : <span>{pub.kind === 'rub' ? `🧽 ${live ?? 0}` : `🌀 ${(live ?? 0).toFixed(1)}`}</span>}
            </div>
          )}
        </>
      )}
      {pub.phase === 'result' && pub.vals && pub.ranks && (
        <div className="entries">
          {Object.entries(pub.ranks).sort((a, b) => a[1] - b[1]).map(([id, rank]) => {
            const p = player(id);
            return (
              <div key={id} className={`entry ${id === me ? 'mine' : ''} ${rank === 1 ? 'win' : ''}`}>
                <b>#{rank}</b>
                {p && <Avatar avatar={p.avatar} size={26} />}
                <span>{p?.name}</span>
                <span className="who">{fmt(pub.kind, pub.vals![id])}</span>
              </div>
            );
          })}
        </div>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </div>
  );
}
