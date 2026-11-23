import './puzzle.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, PlayerStrip, SecondsLeft, Stage, useRafNow } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  rounds: number;
  progress: Record<string, { round: number; next: number }>;
}
interface Priv {
  grid: number[];
  next: number;
  round: number;
  frozenUntil: number;
  times: number[];
}

const COLORS = ['#ff4f9a', '#3da9fc', '#34cf78', '#ffd23f', '#9b6bff', '#ff8a3d'];

export default function NumberHunt({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const now = useRafNow();
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'wrong') {
      sfx('buzz');
      vibrate(100);
    }
    if (ev.type === 'round') sfx('win');
  }, false), []);
  const frozen = (priv?.frozenUntil ?? 0) > now;
  const done = (priv?.round ?? 0) >= pub.rounds;
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(520px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">Board {Math.min(pub.rounds, (priv?.round ?? 0) + 1)}/{pub.rounds}{priv?.round === 1 ? ' · it shuffles!' : ''}</span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {done ? (
        <Banner title="Done! 🎉" sub={`${((priv?.times ?? []).reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s total`} tone="good" big />
      ) : (
        <>
          <Banner title={<>Find <span className="nh-next">{priv?.next ?? 1}</span></>} />
          <div className={`board nh-board ${frozen ? 'frozen' : ''}`} style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {(priv?.grid ?? []).map((n) => (
              <button
                key={n}
                className={`cell nh-cell ${n < (priv?.next ?? 1) ? 'found' : ''}`}
                style={{ color: COLORS[n % COLORS.length], fontSize: `clamp(1rem, ${3.5 + (n % 3) * 0.6}vw, ${1.4 + (n % 3) * 0.3}rem)` }}
                disabled={!isPlayer || frozen}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (n === priv?.next) sfx('tap', 1 + n * 0.02);
                  send({ t: 'tap', n });
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      <PlayerStrip players={players} ids={Object.keys(pub.progress)} size={30} badge={(id) => `${pub.progress[id].round * 25 + (pub.progress[id].round < pub.rounds ? pub.progress[id].next - 1 : 0)}`} highlight={(id) => id === me} />
    </Stage>
  );
}
