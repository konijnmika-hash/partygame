import './reaction.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Countdown, MiniScores, RoundDots, Stage, useRafNow } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  phase: 'find' | 'gap';
  target: string;
  grid: string[];
  cols: number;
  found: Record<string, number>;
  deadline: number;
  scores: Record<string, number>;
}

export default function TapSymbol({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { frozenUntil: number }>) {
  const now = useRafNow();
  const frozen = (priv?.frozenUntil ?? 0) > now;
  const found = pub.found[me] != null;
  useEffect(() => {
    if (found) sfx('correct');
  }, [found, pub.round]);
  useEffect(() => {
    if (frozen) {
      sfx('buzz');
      vibrate(120);
    }
  }, [priv?.frozenUntil]);
  const targetIdx = pub.grid.indexOf(pub.target);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.round} />
      <Countdown deadline={pub.phase === 'find' ? pub.deadline : null} total={8000} />
      <div className="ts-target">
        <span className="tiny">FIND</span>
        <span className="ts-emoji" key={pub.round}>{pub.target}</span>
      </div>
      <div className={`board ts-board ${frozen ? 'frozen' : ''}`} style={{ gridTemplateColumns: `repeat(${pub.cols}, 1fr)` }}>
        {pub.grid.map((sym, i) => (
          <button
            key={`${pub.round}-${i}`}
            className={`cell ts-cell ${pub.phase === 'gap' && i === targetIdx ? 'good' : ''} ${found && i === targetIdx ? 'good' : ''}`}
            disabled={!isPlayer || found || frozen || pub.phase !== 'find'}
            onPointerDown={(e) => {
              e.preventDefault();
              send({ t: 'tap', i });
            }}
          >
            {sym}
          </button>
        ))}
      </div>
      {frozen && <div className="chip chip-red">❄️ Frozen! Wrong symbol</div>}
      {found && <div className="chip chip-green">Found it! #{pub.found[me] + 1}</div>}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
