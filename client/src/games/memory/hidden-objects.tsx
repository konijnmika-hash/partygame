import './memory.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown, MiniScores, RoundDots, Stage, useRafNow } from './_shared';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  scene: number;
  n: number;
  cols: number;
  cells: (string | null)[];
  phase: 'memorize' | 'find' | 'reveal';
  memorizeUntil: number;
  deadline: number;
  targets: string[] | null;
  counts: Record<string, number>;
  scores: Record<string, number>;
  total: number;
}
interface Priv {
  found: number[];
  foundEmoji: string[];
  frozenUntil: number;
  peek: string[] | null;
}

export default function HiddenObjects({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const now = useRafNow();
  const found = priv?.found ?? [];
  const frozen = (priv?.frozenUntil ?? 0) > now;
  useEffect(() => {
    if (found.length) sfx('correct');
  }, [found.length]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'wrong') {
      sfx('buzz');
      vibrate(80);
    }
  }, false), []);
  const list = pub.targets ?? priv?.peek ?? null;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.scene} />
      {pub.phase === 'memorize' && <Countdown deadline={pub.memorizeUntil} total={4000} />}
      {pub.phase === 'find' && <Countdown deadline={pub.deadline} total={45000} />}
      <div className="ho-list">
        {list ? (
          list.map((t) => <span key={t} className={`ho-target ${priv?.foundEmoji.includes(t) ? 'got' : ''}`}>{t}</span>)
        ) : (
          <>
            {Array.from({ length: pub.total }, (_, k) => <span key={k} className={`ho-target ${k < found.length ? 'got' : 'hidden'}`}>{k < found.length ? priv!.foundEmoji[k] : '?'}</span>)}
            {isPlayer && pub.phase === 'find' && <button className="btn btn-ghost btn-sm" onClick={() => send({ t: 'peek' })}>👀 Peek (−10)</button>}
          </>
        )}
      </div>
      <Banner title={pub.phase === 'memorize' ? 'Remember these 5 objects!' : pub.phase === 'find' ? `Find them! ${found.length}/${pub.total}` : 'Scene complete'} tone={frozen ? 'bad' : 'default'} />
      {pub.phase !== 'memorize' && (
        <div className={`ho-scene ${frozen ? 'frozen' : ''}`} style={{ gridTemplateColumns: `repeat(${pub.cols}, 1fr)` }}>
          {pub.cells.map((e, i) => (
            <button key={i} className={`ho-cell ${found.includes(i) ? 'found' : ''} ${pub.phase === 'reveal' && e && pub.targets?.includes(e) && !found.includes(i) ? 'missed' : ''}`} disabled={!isPlayer || pub.phase !== 'find' || frozen} onPointerDown={(ev) => { ev.preventDefault(); send({ t: 'tap', i }); }} style={{ transform: `rotate(${((i * 37) % 30) - 15}deg)` }}>
              {e ?? ''}
            </button>
          ))}
        </div>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
