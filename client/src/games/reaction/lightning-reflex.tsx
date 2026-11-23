import './reaction.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, RoundDots, Stage, TapZone, useChangedAt } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  rounds: number;
  phase: 'wait' | 'go' | 'gap';
  goAt: number;
  tapped: string[];
  last: Record<string, number | 'early' | null>;
  best: Record<string, number | null>;
}

export default function LightningReflex({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const [myTime, setMyTime] = useState<number | 'early' | null>(null);
  const shownAt = useChangedAt(pub.phase === 'go' ? pub.goAt : 0);
  const tapped = pub.tapped.includes(me);

  useEffect(() => {
    if (pub.phase === 'go') sfx('go');
    if (pub.phase === 'wait') setMyTime(null);
  }, [pub.phase, pub.round]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'false-start') {
      sfx('wrong');
      setMyTime('early');
    }
  }, false), []);

  const tap = () => {
    if (!isPlayer || tapped || pub.phase === 'gap') return;
    if (pub.phase === 'wait') {
      send({ t: 'tap', early: true });
      setMyTime('early');
      sfx('wrong');
      return;
    }
    const ms = Math.round(performance.now() - shownAt.current);
    send({ t: 'tap', ms });
    setMyTime(ms);
    sfx('tap');
  };

  const bg = pub.phase === 'go' ? 'linear-gradient(160deg,#3ce68a,#11b866)' : pub.phase === 'wait' ? 'linear-gradient(160deg,#ff5a6e,#d6264a)' : 'linear-gradient(160deg,#7b5cff,#5233df)';
  const bests: Record<string, number> = {};
  for (const [id, v] of Object.entries(pub.best)) if (v != null) bests[id] = -v;

  return (
    <Stage className="full">
      <TapZone onTap={tap} className="lr-zone" style={{ background: bg, margin: 10, width: 'calc(100% - 20px)' }} disabled={!isPlayer}>
        <RoundDots total={pub.rounds} current={pub.round} />
        {pub.phase === 'wait' && (myTime === 'early' ? <Banner title="Too early! 🙈" sub="False start — wait for the next round" tone="warn" big /> : <Banner title="Wait for green..." sub="Don't tap yet!" big />)}
        {pub.phase === 'go' && (tapped ? <Banner title={typeof myTime === 'number' ? `${myTime} ms` : 'Tapped!'} sub="Nice! Waiting for the others" big /> : <Banner title="TAP!" big />)}
        {pub.phase === 'gap' && (
          <div className="stack" style={{ alignItems: 'center' }}>
            <Banner
              title={pub.last[me] === 'early' ? 'False start!' : typeof pub.last[me] === 'number' ? `${pub.last[me]} ms` : 'Missed!'}
              sub={`Round ${pub.round + 1} of ${pub.rounds}`}
              tone={typeof pub.last[me] === 'number' && (pub.last[me] as number) < 300 ? 'good' : 'default'}
              big
            />
            <div className="row" style={{ justifyContent: 'center' }}>
              {Object.entries(pub.last)
                .sort((a, b) => (typeof a[1] === 'number' ? a[1] : 9999) - (typeof b[1] === 'number' ? b[1] : 9999))
                .map(([id, v]) => (
                  <span key={id} className={`chip ${id === me ? 'chip-yellow' : 'chip-dark'}`}>
                    {players.find((p) => p.id === id)?.name}: {v === 'early' ? 'early' : v == null ? 'miss' : `${v}ms`}
                  </span>
                ))}
            </div>
          </div>
        )}
        {Object.keys(bests).length > 0 && (
          <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
            <MiniScores players={players} scores={bests} me={me} fmt={(v) => `${-v}ms`} title="Best times" limit={5} />
          </div>
        )}
      </TapZone>
    </Stage>
  );
}
