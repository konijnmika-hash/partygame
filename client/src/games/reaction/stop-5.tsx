import './reaction.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, RoundDots, Stage, TapZone, useChangedAt, useRafNow, nameOf } from '../../game/kit';
import { sfx } from '../../audio/sfx';
import { useStore } from '../../state/store';

interface Pub {
  attempt: number;
  n: number;
  target: number;
  phase: 'ready' | 'running' | 'reveal';
  startAt: number;
  stopped: string[];
  stops: Record<string, number> | null;
  totals: Record<string, number>;
}

export default function Stop5({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: number | null }>) {
  const started = useChangedAt(pub.phase === 'running' ? pub.startAt : 0);
  const now = useRafNow();
  const [local, setLocal] = useState<number | null>(null);
  const hard = useStore((s) => s.room?.settings.difficulty === 'hard');
  useEffect(() => {
    if (pub.phase === 'running') {
      sfx('go');
      setLocal(null);
    }
  }, [pub.phase, pub.attempt]);
  const elapsed = pub.phase === 'running' ? Math.max(0, now - pub.startAt) : 0;
  const visibleFor = hard ? 1000 : 1500;
  const stopped = priv?.mine != null || local != null;
  const stop = () => {
    if (!isPlayer || pub.phase !== 'running' || stopped) return;
    const ms = Math.round(performance.now() - started.current);
    setLocal(ms);
    send({ t: 'stop', ms });
    sfx('tap');
  };
  const target = pub.target * 1000;
  return (
    <Stage className="full">
      <TapZone onTap={stop} disabled={!isPlayer || pub.phase !== 'running' || stopped} style={{ margin: 10, width: 'calc(100% - 20px)', background: 'rgba(0,0,0,.18)' }}>
        <RoundDots total={pub.n} current={pub.attempt} />
        <Banner title={`Stop at exactly ${pub.target.toFixed(pub.target % 1 ? 2 : 0)} s`} sub={pub.phase === 'ready' ? 'Get ready...' : pub.phase === 'running' ? (stopped ? 'Locked in! 🔒' : 'Tap anywhere to STOP') : 'Results'} />
        <div className={`stop-clock ${pub.phase === 'running' && elapsed > visibleFor ? 'hidden-time' : ''}`}>
          {pub.phase === 'ready' ? '0.00' : pub.phase === 'running' ? (elapsed > visibleFor ? '?.??' : (elapsed / 1000).toFixed(2)) : priv?.mine != null ? (priv.mine / 1000).toFixed(3) : '—'}
        </div>
        {pub.phase === 'running' && !stopped && <div className="stop-btn">STOP</div>}
        {pub.phase === 'reveal' && pub.stops && (
          <div className="stop-line">
            <div className="sl-axis">
              <span className="sl-target" style={{ left: '50%' }}>🎯</span>
              {players.filter((p) => pub.stops![p.id] != null).map((p) => {
                const off = (pub.stops![p.id] - target) / 2500;
                return (
                  <span key={p.id} className={`sl-dot ${p.id === me ? 'me' : ''}`} style={{ left: `${50 + Math.max(-48, Math.min(48, off * 48))}%` }} title={p.name}>
                    {p.name.slice(0, 1)}
                  </span>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              {Object.entries(pub.stops)
                .sort((a, b) => Math.abs(a[1] - target) - Math.abs(b[1] - target))
                .map(([id, v]) => (
                  <span key={id} className={`chip ${id === me ? 'chip-yellow' : 'chip-dark'}`}>
                    {nameOf(players, id)}: {(v / 1000).toFixed(3)}s ({v >= target ? '+' : '−'}{(Math.abs(v - target) / 1000).toFixed(3)})
                  </span>
                ))}
            </div>
          </div>
        )}
      </TapZone>
    </Stage>
  );
}
