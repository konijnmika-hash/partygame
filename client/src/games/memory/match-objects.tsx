import './memory.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, PlayerStrip, SecondsLeft, Stage, useSecondsLeftLocal } from './_shared';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  boards: number;
  progress: Record<string, { board: number; matched: number }>;
}
interface Priv {
  board: number;
  cards: (string | null)[];
  preview: boolean;
  previewUntil: number;
  penalty: number;
  times: number[];
}

export default function MatchObjects({ pub, priv, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const [miss, setMiss] = useState<{ i: number; j: number; fi: string; fj: string } | null>(null);
  const previewLeft = useSecondsLeftLocal(priv?.preview ? priv.previewUntil : null);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'flip') sfx('swap');
    if (ev.type === 'match') sfx('correct');
    if (ev.type === 'miss') {
      sfx('wrong');
      vibrate(60);
      setMiss(ev.data as any);
      setTimeout(() => setMiss(null), 700);
    }
  }, false), []);
  if (!priv) return <Stage className="centered"><Banner title="Watching..." /></Stage>;
  const done = priv.board >= pub.boards;
  const cols = priv.cards.length <= 12 ? 4 : priv.cards.length <= 16 ? 4 : 5;
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(560px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">Board {Math.min(pub.boards, priv.board + 1)}/{pub.boards}</span>
        {priv.penalty > 0 && <span className="chip chip-red">+{(priv.penalty / 1000).toFixed(1)}s penalty</span>}
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {done ? (
        <Banner title="All matched! 🍒" sub={`${(priv.times.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s total`} tone="good" big />
      ) : (
        <>
          <Banner title={priv.preview ? `Memorize! ${previewLeft}` : 'Match the pairs!'} tone={priv.preview ? 'warn' : 'default'} />
          <div className="board mt-board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${Math.ceil(priv.cards.length / cols)}` }}>
            {priv.cards.map((f, i) => {
              const face = f ?? (miss && (miss.i === i || miss.j === i) ? (miss.i === i ? miss.fi : miss.fj) : null);
              return (
                <button key={`${priv.board}-${i}`} className={`mt-card ${face ? 'up' : ''} ${miss && (miss.i === i || miss.j === i) ? 'miss' : ''}`} disabled={!isPlayer || priv.preview || !!f} onPointerDown={(e) => { e.preventDefault(); send({ t: 'flip', i }); }}>
                  <span className="mt-inner">{face ?? '❓'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <PlayerStrip players={players} ids={Object.keys(pub.progress)} size={30} badge={(id) => `${pub.progress[id].board}/${pub.boards}`} />
    </Stage>
  );
}
