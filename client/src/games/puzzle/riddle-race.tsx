import './puzzle.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown, MiniScores, PlayerStrip, RoundDots, Stage, TextEntry } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  riddle: string;
  mask: string;
  hint: number;
  phase: 'play' | 'reveal';
  deadline: number;
  solved: Record<string, number>;
  answer: string | null;
  scores: Record<string, number>;
}

export default function RiddleRace({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const [fb, setFb] = useState<{ t: string; k: number; tone: 'bad' | 'warn' | 'good' } | null>(null);
  useEffect(() => setFb(null), [pub.i]);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as any;
    if (ev.type === 'wrong') {
      sfx('wrong');
      setFb({ t: `“${d.g}” — nope!`, k: Date.now(), tone: 'bad' });
    } else if (ev.type === 'close') {
      sfx('blip');
      setFb({ t: `“${d.g}” — so close! Check the spelling`, k: Date.now(), tone: 'warn' });
    } else if (ev.type === 'solved') {
      sfx('win');
      setFb({ t: `Correct! +${d.pts}`, k: Date.now(), tone: 'good' });
    }
  }, false), []);
  const solved = pub.solved[me] != null;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <Countdown deadline={pub.phase === 'play' ? pub.deadline : null} total={32000} />
      <div className="g-col">
        <div className="g-prompt riddle-card anim-pop" key={pub.i}>
          <small>Riddle {pub.i + 1}</small>
          {pub.riddle}
        </div>
        <div className="ws-hint">{(pub.phase === 'reveal' && pub.answer ? pub.answer : pub.mask).split('').map((c, i) => <span key={i} className={c === ' ' ? 'gap' : ''}>{c === '_' ? '·' : c.toUpperCase()}</span>)}</div>
        {pub.phase === 'reveal' ? (
          <Banner title={pub.answer?.toUpperCase()} sub={solved ? 'You cracked it!' : 'That was the answer'} tone={solved ? 'good' : 'info'} />
        ) : solved ? (
          <Banner title="Solved! 🦉" sub={`#${pub.solved[me] + 1} to crack it`} tone="good" />
        ) : (
          <TextEntry disabled={!isPlayer} onSubmit={(g) => send({ t: 'guess', g })} placeholder="Your answer..." button="Guess" />
        )}
        {fb && !solved && <div className={`chip ${fb.tone === 'bad' ? 'chip-red' : 'chip-yellow'} anim-pop`} key={fb.k} style={{ alignSelf: 'center' }}>{fb.t}</div>}
      </div>
      <PlayerStrip players={players} ids={Object.keys(pub.scores)} size={30} highlight={(id) => pub.solved[id] != null} badge={(id) => (pub.solved[id] != null ? '✓' : '')} />
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
