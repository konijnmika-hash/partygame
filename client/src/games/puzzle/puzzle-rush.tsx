import './puzzle.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, PlayerStrip, SecondsLeft, Stage, useKeys } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  rounds: number;
  progress: Record<string, { round: number; moves: number }>;
  order: string[];
}
interface Priv {
  board: number[];
  round: number;
  moves: number;
  times: number[];
}

const SIZE = 3;

export default function PuzzleRush({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'solved') sfx('win');
  }, false), []);
  const board = priv?.board ?? [];
  const blank = board.indexOf(0);
  const done = (priv?.round ?? 0) >= pub.rounds;
  const move = (tile: number) => {
    if (!isPlayer || done) return;
    const i = board.indexOf(tile);
    const near = Math.abs(i - blank) === SIZE || (Math.abs(i - blank) === 1 && Math.floor(i / SIZE) === Math.floor(blank / SIZE));
    if (!near) return sfx('buzz');
    sfx('swap');
    send({ t: 'move', tile });
  };
  // arrow keys slide the tile next to the blank into it
  useKeys((k) => {
    const r = Math.floor(blank / SIZE), c = blank % SIZE;
    const from = k === 'ArrowUp' ? (r < SIZE - 1 ? blank + SIZE : -1) : k === 'ArrowDown' ? (r > 0 ? blank - SIZE : -1) : k === 'ArrowLeft' ? (c < SIZE - 1 ? blank + 1 : -1) : k === 'ArrowRight' ? (c > 0 ? blank - 1 : -1) : -1;
    if (from >= 0) move(board[from]);
  }, isPlayer && !done);
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(520px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">Puzzle {Math.min(pub.rounds, (priv?.round ?? 0) + 1)}/{pub.rounds} · {priv?.moves ?? 0} moves</span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {done ? (
        <Banner title="All solved! 🧩" sub={`Finished #${pub.order.indexOf(me) + 1}`} tone="good" big />
      ) : (
        <div className="board slide-board" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {board.map((t, i) => (
            <button key={t === 0 ? 'blank' : t} className={`cell slide-tile ${t === 0 ? 'blank' : ''} ${t !== 0 && t === i + 1 ? 'home' : ''}`} disabled={t === 0 || !isPlayer} onPointerDown={(e) => { e.preventDefault(); if (t) move(t); }}>
              {t || ''}
            </button>
          ))}
        </div>
      )}
      <p className="tiny muted">Put the tiles in order 1–8 with the gap last. Tap a tile next to the gap (or use arrow keys).</p>
      <PlayerStrip players={players} ids={Object.keys(pub.progress)} size={32} highlight={(id) => pub.progress[id].round >= pub.rounds} badge={(id) => `${pub.progress[id].round}/${pub.rounds}`} />
    </Stage>
  );
}
