import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ChoiceGrid, MiniScores, RoundDots, Stage } from '../../game/kit';
import { Avatars, DoneBar, Phase } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  items: string[];
  phase: 'pick' | 'reveal';
  deadline: number;
  picked: string[];
  reveal: Record<string, number> | null;
  scores: Record<string, number>;
}

export default function OddOneOut({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: number | null }>) {
  const ids = Object.keys(pub.scores);
  const mine = priv?.mine ?? null;
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.reveal && mine != null) {
      const same = Object.entries(pub.reveal).filter(([id, c]) => id !== me && c === mine).length;
      sfx(same > 0 ? 'correct' : 'blip');
    }
  }, [pub.phase, pub.i]);
  const pickers = (i: number) => (pub.reveal ? Object.entries(pub.reveal).filter(([, c]) => c === i).map(([id]) => id) : []);
  const top = pub.reveal ? Math.max(...pub.items.map((_, i) => pickers(i).length)) : 0;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <Phase title="Which one doesn't belong?" sub="No right answer — match what the others pick!" deadline={pub.phase === 'pick' ? pub.deadline : null} total={13000} />
      <ChoiceGrid
        cols={2}
        choices={pub.items.map((it, i) => ({ label: it, sub: pub.reveal ? <><Avatars players={players} ids={pickers(i)} /> {pickers(i).length}</> : undefined }))}
        picked={mine}
        correct={pub.reveal ? pub.items.findIndex((_, i) => pickers(i).length === top && top > 0) : null}
        disabled={!isPlayer || mine != null || pub.phase !== 'pick'}
        onPick={(c) => send({ t: 'pick', c })}
      />
      {pub.phase === 'pick' && <DoneBar players={players} ids={ids} done={pub.picked} label="Picked" />}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
