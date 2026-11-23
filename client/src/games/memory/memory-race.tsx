import './memory.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, DPad, PlayerStrip, SecondsLeft, Stage, useKeys } from './_shared';
import { Avatar } from '../../components/ui';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';
import { isTouchDevice } from '../../game/input';

interface Pub {
  cols: number;
  rows: number;
  phase: 'preview' | 'race';
  preview: number[] | null;
  previewUntil: number;
  start: number;
  traps: number[];
  pos: Record<string, number>;
  finished: string[];
  endsAt: number;
  best: Record<string, number>;
  pathLen: number;
}

export default function MemoryRace({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const myPos = pub.pos[me];
  const done = pub.finished.includes(me);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'trap') {
      sfx('boom');
      vibrate([80, 40, 80]);
    }
    if (ev.type === 'finish') sfx('win');
  }, false), []);
  useEffect(() => {
    if (myPos != null && pub.phase === 'race') sfx('tap');
  }, [myPos]);
  const step = (cell: number) => {
    if (!isPlayer || pub.phase !== 'race' || done) return;
    send({ t: 'step', cell });
  };
  const dir = (d: 'up' | 'down' | 'left' | 'right') => {
    if (myPos == null) return;
    const r = Math.floor(myPos / pub.cols), c = myPos % pub.cols;
    const [nr, nc] = d === 'up' ? [r - 1, c] : d === 'down' ? [r + 1, c] : d === 'left' ? [r, c - 1] : [r, c + 1];
    if (nr < 0 || nc < 0 || nr >= pub.rows || nc >= pub.cols) return;
    step(nr * pub.cols + nc);
  };
  useKeys((k, e) => {
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    if (map[k]) {
      e.preventDefault();
      dir(map[k]);
    }
  }, isPlayer && pub.phase === 'race' && !done && !isTouchDevice());
  const occupants = (cell: number) => Object.entries(pub.pos).filter(([, p]) => p === cell).map(([id]) => id);
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(520px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">{pub.phase === 'preview' ? 'Memorize the safe path!' : done ? `Finished #${pub.finished.indexOf(me) + 1}!` : 'Cross to the top row 🏁'}</span>
        {pub.phase === 'race' && <SecondsLeft deadline={pub.endsAt} />}
      </div>
      {pub.phase === 'preview' && <Banner title="👀 Remember the glowing path" />}
      <div className="mr-wrap">
        <div className="board mr-board" style={{ gridTemplateColumns: `repeat(${pub.cols}, 1fr)`, aspectRatio: `${pub.cols} / ${pub.rows}` }}>
          {Array.from({ length: pub.cols * pub.rows }, (_, i) => {
            const isPath = pub.preview?.includes(i);
            const trap = pub.traps.includes(i);
            const occ = occupants(i);
            const goal = Math.floor(i / pub.cols) === 0;
            const adj = myPos != null && Math.abs(Math.floor(i / pub.cols) - Math.floor(myPos / pub.cols)) + Math.abs((i % pub.cols) - (myPos % pub.cols)) === 1;
            return (
              <button key={i} className={`cell mr-cell ${isPath ? 'lit' : ''} ${trap ? 'bad' : ''} ${goal ? 'goal' : ''} ${adj && pub.phase === 'race' && !done ? 'adj' : ''} ${i === pub.start ? 'start' : ''}`} onPointerDown={(e) => { e.preventDefault(); step(i); }} disabled={!isPlayer || pub.phase !== 'race'}>
                {trap && <span className="mr-x">✖</span>}
                <span className="mr-occ">
                  {occ.slice(0, 3).map((id) => {
                    const p = player(id);
                    return p ? <Avatar key={id} avatar={p.avatar} size={id === me ? 26 : 18} /> : null;
                  })}
                </span>
              </button>
            );
          })}
        </div>
        {isPlayer && isTouchDevice() && pub.phase === 'race' && !done && <DPad onDir={dir} />}
      </div>
      {isPlayer && !isTouchDevice() && <p className="tiny muted">Arrow keys / WASD or tap a neighbouring tile to step.</p>}
      <PlayerStrip players={players} ids={Object.keys(pub.pos)} size={28} highlight={(id) => pub.finished.includes(id)} badge={(id) => (pub.finished.includes(id) ? `#${pub.finished.indexOf(id) + 1}` : `${pub.best[id]}/${pub.pathLen - 1}`)} />
    </Stage>
  );
}
