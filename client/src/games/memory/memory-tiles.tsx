import './memory.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown, PlayerStrip, Stage, nameOf } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { bodyColor } from '../../components/avatarSvg';
import { sfx } from '../../audio/sfx';

interface Pub {
  cards: (string | null)[];
  matchedBy: (string | null)[];
  open: number[];
  turn: string;
  order: string[];
  deadline: number;
  phase: 'pick' | 'check';
  pairs: Record<string, number>;
}

export default function MemoryTiles({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const myTurn = pub.turn === me && pub.phase === 'pick';
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'flip') sfx('swap');
    if (ev.type === 'match') sfx((ev.data as any).by === me ? 'win' : 'correct');
  }, false), []);
  useEffect(() => {
    if (myTurn) sfx('ding');
  }, [myTurn]);
  const cols = pub.cards.length <= 16 ? 4 : 5;
  return (
    <Stage>
      <Banner title={myTurn ? 'Your turn! Flip two cards' : `${nameOf(players, pub.turn)}'s turn`} sub={pub.phase === 'check' ? (pub.open.length === 2 && pub.cards[pub.open[0]] === pub.cards[pub.open[1]] ? 'A match! 🎉' : 'No match...') : 'Match pairs to score and go again'} tone={myTurn ? 'warn' : 'default'} />
      <Countdown deadline={pub.phase === 'pick' ? pub.deadline : null} total={9000} />
      <div className="board mt-board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${Math.ceil(pub.cards.length / cols)}` }}>
        {pub.cards.map((f, i) => {
          const owner = pub.matchedBy[i];
          const ownerColor = owner ? bodyColor(player(owner)?.avatar ?? { color: 'c-sky' } as any) : undefined;
          return (
            <button key={i} className={`mt-card ${f ? 'up' : ''} ${owner ? 'matched' : ''}`} style={owner ? { borderColor: ownerColor } : undefined} disabled={!isPlayer || !myTurn || !!f} onPointerDown={(e) => { e.preventDefault(); send({ t: 'flip', i }); }}>
              <span className="mt-inner">{f ?? '❓'}</span>
            </button>
          );
        })}
      </div>
      <PlayerStrip players={players} ids={pub.order} size={34} highlight={(id) => id === pub.turn} badge={(id) => `${pub.pairs[id] ?? 0} pairs`} />
    </Stage>
  );
}
