import './reaction.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ChoiceGrid, Countdown, RoundDots, Stage, useChangedAt, MiniScores } from '../../game/kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'show' | 'gap';
  word: string;
  ink: string;
  options: { c: number; hex: string }[];
  shownAt: number;
  deadline: number;
  picked: string[];
  reveal: { ink: number; picks: Record<string, { c: number; ok: boolean; pts: number }> } | null;
  scores: Record<string, number>;
}

export default function ColorReaction({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: { c: number; ok: boolean; pts: number } | null }>) {
  const shown = useChangedAt(pub.i);
  const mine = priv?.mine;
  useEffect(() => {
    if (mine) sfx(mine.ok ? 'correct' : 'wrong');
  }, [mine?.c, pub.i]);
  const correctIdx = pub.reveal ? pub.options.findIndex((o) => o.c === pub.reveal!.ink) : null;
  const pickedIdx = mine ? pub.options.findIndex((o) => o.c === mine.c) : null;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <Countdown deadline={pub.phase === 'show' ? pub.deadline : null} total={pub.deadline - pub.shownAt} />
      <div className="cr-card" key={pub.i}>
        <small>Tap the INK colour</small>
        <span className="cr-word" style={{ color: pub.ink }}>{pub.word}</span>
      </div>
      <ChoiceGrid
        cols={pub.options.length > 3 ? 2 : 3}
        choices={pub.options.map((o) => ({ label: <span className="cr-swatch" style={{ background: o.hex }} />, color: '#fff' }))}
        picked={pickedIdx}
        correct={pub.phase === 'gap' ? correctIdx : mine?.ok ? pickedIdx : null}
        wrong={mine && !mine.ok && pickedIdx != null ? [pickedIdx] : []}
        disabled={!isPlayer || !!mine || pub.phase !== 'show'}
        onPick={(i) => send({ t: 'pick', c: pub.options[i].c, ms: Math.round(performance.now() - shown.current) })}
      />
      <div className="g-row">
        {mine && <span className={`chip ${mine.ok ? 'chip-green' : 'chip-red'}`}>{mine.ok ? `+${mine.pts}` : `${mine.pts}`}</span>}
        <span className="chip chip-dark">{pub.scores[me] ?? 0} pts</span>
      </div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
