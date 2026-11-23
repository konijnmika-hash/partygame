import './puzzle.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown, MiniScores, PlayerStrip, RoundDots, Stage } from '../../game/kit';
import { LetterTiles } from '../../game/LetterTiles';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  scrambled: string;
  len: number;
  mask: string;
  phase: 'play' | 'reveal';
  deadline: number;
  solved: Record<string, number>;
  answer: string | null;
  scores: Record<string, number>;
}

export default function WordScramble({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const [shake, setShake] = useState(0);
  const [got, setGot] = useState<number | null>(null);
  useEffect(() => setGot(null), [pub.i]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'wrong') {
      sfx('wrong');
      setShake((x) => x + 1);
    }
    if (ev.type === 'solved') {
      sfx('correct');
      setGot((ev.data as any).pts);
    }
  }, false), []);
  const solved = pub.solved[me] != null;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <Countdown deadline={pub.phase === 'play' ? pub.deadline : null} total={22000} />
      <div className="ws-hint">{pub.mask.split('').map((c, i) => <span key={i}>{c === '_' ? '·' : c.toUpperCase()}</span>)}</div>
      {pub.phase === 'reveal' ? (
        <Banner title={pub.answer?.toUpperCase()} sub={solved ? `You got it! +${got ?? ''}` : 'The word was...'} tone={solved ? 'good' : 'info'} big />
      ) : solved ? (
        <Banner title={`Solved! +${got ?? ''}`} sub={`You were #${pub.solved[me] + 1}`} tone="good" big />
      ) : (
        <div className={shake ? 'anim-shake' : ''} key={shake} style={{ width: '100%' }}>
          <LetterTiles letters={pub.scrambled} disabled={!isPlayer} autoSubmitLength={pub.len} resetKey={`${pub.i}-${shake}`} onSubmit={(w) => send({ t: 'guess', w })} />
        </div>
      )}
      <PlayerStrip players={players} ids={Object.keys(pub.scores)} size={32} highlight={(id) => pub.solved[id] != null} badge={(id) => (pub.solved[id] != null ? `#${pub.solved[id] + 1}` : '')} />
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
