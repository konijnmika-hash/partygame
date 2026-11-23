import './reaction.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { MiniScores, SecondsLeft, Stage, useRafNow } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Target {
  id: number;
  x: number;
  y: number;
  kind: 'big' | 'small' | 'tiny' | 'skull';
  born: number;
  ttl: number;
}
interface Pub {
  endsAt: number;
  targets: Target[];
  pops: { id: number; x: number; y: number; pid: string; kind: string; at: number }[];
  scores: Record<string, number>;
}

const R = { big: 70, small: 46, tiny: 30, skull: 56 };
const PTS = { big: 1, small: 2, tiny: 3, skull: -2 };

export default function QuickClick({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const now = useRafNow();
  const tried = useRef(new Set<number>());
  const myScore = pub.scores[me] ?? 0;
  const prev = useRef(myScore);
  useEffect(() => {
    if (myScore > prev.current) sfx('coin');
    else if (myScore < prev.current) sfx('wrong');
    prev.current = myScore;
  }, [myScore]);
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(900px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">🎯 {myScore} pts</span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      <div className="qc-board">
        {pub.targets.map((t) => {
          const life = Math.max(0, 1 - (now - t.born) / t.ttl);
          const r = R[t.kind];
          return (
            <button
              key={t.id}
              className={`qc-target k-${t.kind}`}
              style={{ left: `${(t.x / 1000) * 100}%`, top: `${(t.y / 700) * 100}%`, width: `${(r * 2 / 1000) * 100}%`, ['--life' as any]: life }}
              disabled={!isPlayer}
              onPointerDown={(e) => {
                e.preventDefault();
                if (tried.current.has(t.id)) return;
                tried.current.add(t.id);
                vibrate(10);
                sfx('pop', t.kind === 'tiny' ? 1.4 : 1);
                send({ t: 'hit', id: t.id });
              }}
              aria-label={t.kind === 'skull' ? 'Skull (avoid!)' : `Target worth ${PTS[t.kind]}`}
            >
              {t.kind === 'skull' ? '💀' : <span className="qc-ring" />}
            </button>
          );
        })}
        {pub.pops.map((p) => {
          const pl = player(p.pid);
          return (
            <div key={`${p.id}-${p.pid}`} className={`qc-pop ${p.pid === me ? 'me' : ''}`} style={{ left: `${(p.x / 1000) * 100}%`, top: `${(p.y / 700) * 100}%` }}>
              {p.kind === 'skull' ? '💀−2' : `+${PTS[p.kind as keyof typeof PTS]}`} <small>{pl?.name}</small>
            </div>
          );
        })}
      </div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </Stage>
  );
}
