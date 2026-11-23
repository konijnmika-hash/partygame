import './memory.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, Countdown, MiniScores, RoundDots, Stage } from './_shared';
import { sfx } from '../../audio/sfx';

interface Pub {
  scene: number;
  n: number;
  qi: number;
  qn: number;
  phase: 'study' | 'question' | 'reveal';
  grid: ({ e: string; hex: string } | null)[] | null;
  cols: number;
  question: { text: string; choices: string[] } | null;
  answer: number | null;
  deadline: number;
  shownAt: number;
  answered: string[];
  gains: Record<string, number> | null;
  scores: Record<string, number>;
}

export default function RememberRoom({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: number | null }>) {
  const mine = priv?.mine ?? null;
  useEffect(() => {
    if (pub.phase === 'study') sfx('whoosh');
    if (pub.phase === 'reveal' && mine != null) sfx(mine === pub.answer ? 'correct' : 'wrong');
  }, [pub.phase, pub.qi, pub.scene]);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.scene} />
      <Countdown deadline={pub.deadline} total={pub.deadline - pub.shownAt} />
      {pub.phase === 'study' && <Banner title="Study the room! 👀" sub="Questions are coming..." />}
      {pub.grid && (
        <div className={`room ${pub.phase === 'reveal' ? 'small' : ''}`} style={{ gridTemplateColumns: `repeat(${pub.cols}, 1fr)` }}>
          {pub.grid.map((c, i) => (
            <div key={i} className="room-slot" style={{ background: c ? c.hex : undefined }}>{c?.e}</div>
          ))}
        </div>
      )}
      {pub.question && (
        <div className="g-col">
          <div className="g-prompt anim-pop" key={`${pub.scene}-${pub.qi}`}>
            <small>Question {pub.qi + 1} of {pub.qn}</small>
            {pub.question.text}
          </div>
          <ChoiceGrid
            choices={pub.question.choices.map((c) => ({ label: <span style={{ fontSize: /^\p{Extended_Pictographic}/u.test(c) ? '2rem' : undefined }}>{c}</span> }))}
            picked={mine}
            correct={pub.phase === 'reveal' ? pub.answer : null}
            wrong={pub.phase === 'reveal' && mine != null && mine !== pub.answer ? [mine] : []}
            disabled={!isPlayer || mine != null || pub.phase !== 'question'}
            onPick={(c) => send({ t: 'pick', c })}
          />
          {pub.gains && pub.gains[me] != null && <span className={`chip ${pub.gains[me] > 0 ? 'chip-green' : 'chip-red'}`} style={{ alignSelf: 'center' }}>{pub.gains[me] > 0 ? `+${pub.gains[me]}` : 'Wrong!'}</span>}
        </div>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
