import './reaction.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, RoundDots, Stage, TapZone, useChangedAt } from '../../game/kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'blank' | 'show' | 'done';
  flash: { label: string; color: string; shape: string } | null;
  shownAt: number;
  taps: Record<string, number>;
  scores: Record<string, number>;
}

export default function FakeButton({ pub, me, isPlayer, send }: GameViewProps<Pub>) {
  const shown = useChangedAt(pub.phase === 'show' ? pub.i : -1);
  const [fx, setFx] = useState<{ k: number; v: number } | null>(null);
  const mine = pub.taps[me];
  useEffect(() => {
    if (pub.phase === 'show') sfx('blip', 1 + (pub.i % 3) * 0.1);
  }, [pub.phase, pub.i]);
  useEffect(() => {
    if (mine === undefined) return;
    setFx({ k: Date.now(), v: mine });
    sfx(mine > 0 ? 'correct' : 'wrong');
  }, [mine, pub.i]);
  const tap = () => {
    if (!isPlayer || mine !== undefined) return;
    send({ t: 'tap', ms: Math.round(performance.now() - shown.current) });
  };
  const f = pub.flash;
  return (
    <Stage className="full">
      <TapZone onTap={tap} disabled={!isPlayer}>
        <RoundDots total={pub.n} current={pub.i} />
        <div className="fb-area">
          {f ? (
            <div key={pub.i} className={`fb-button shape-${f.shape}`} style={{ background: f.color }}>
              <span>{f.label}</span>
            </div>
          ) : (
            <div className="fb-empty">Wait for it...</div>
          )}
          {fx && <div key={fx.k} className={`float-pts ${fx.v > 0 ? 'good' : 'bad'}`}>{fx.v > 0 ? `+${fx.v}` : fx.v === -60 ? 'FOOLED! −60' : `${fx.v}`}</div>}
        </div>
        <Banner title={`${pub.scores[me] ?? 0} pts`} sub="Only the ROUND GREEN “GO!” button counts" />
      </TapZone>
    </Stage>
  );
}
