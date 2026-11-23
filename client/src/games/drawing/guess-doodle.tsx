import './drawing.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { StrokesView, type StrokeData } from '../../game/DrawCanvas';
import { Banner, ChoiceGrid, Countdown, MiniScores, RoundDots, useRafNow } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  choices: string[];
  phase: 'draw' | 'reveal';
  deadline: number;
  startedAt: number;
  solvedBy: string[];
  answer: string | null;
  scores: Record<string, number>;
}

export default function GuessDoodle({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { lockUntil: number; solved: boolean }>) {
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const roundRef = useRef(pub.round);
  roundRef.current = pub.round;
  const [picked, setPicked] = useState<number | null>(null);
  const now = useRafNow();
  useEffect(() => {
    setStrokes([]);
    setPicked(null);
  }, [pub.round]);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as any;
    if (ev.type === 'gd' && d.round === roundRef.current) {
      setStrokes((prev) => {
        const next = prev.map((s) => ({ ...s, p: [...s.p] }));
        for (const { i, p } of d.delta as { i: number; p: number[] }[]) {
          if (!next[i]) next[i] = { c: 0, w: 12, p: [] };
          next[i].p.push(...p);
        }
        return next;
      });
    } else if (ev.type === 'gd-full' && d.round === roundRef.current) {
      setStrokes((d.strokes as number[][]).map((p) => ({ c: 0, w: 12, p })));
    } else if (ev.type === 'correct') sfx('win');
    else if (ev.type === 'wrong') sfx('wrong');
  }), []);
  const locked = (priv?.lockUntil ?? 0) > now;
  const correctIdx = pub.answer ? pub.choices.indexOf(pub.answer) : null;
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.round} />
      <Countdown deadline={pub.phase === 'draw' ? pub.deadline : null} total={pub.deadline - pub.startedAt} />
      <div className="draw-stage gd-stage"><StrokesView strokes={strokes} /></div>
      {pub.phase === 'reveal' ? (
        <Banner title={`It's a ${pub.answer}!`} sub={priv?.solved ? 'You got it! 🎉' : 'Better luck next doodle'} tone={priv?.solved ? 'good' : 'info'} />
      ) : priv?.solved ? (
        <Banner title="Correct! 🎉" sub={`${pub.solvedBy.length} solved so far`} tone="good" />
      ) : (
        <Banner title={locked ? '❄️ Wrong — wait a sec' : 'What is it?'} tone={locked ? 'bad' : 'default'} />
      )}
      <ChoiceGrid
        compact
        cols={4}
        choices={pub.choices.map((c) => ({ label: c }))}
        picked={picked}
        correct={correctIdx}
        disabled={!isPlayer || priv?.solved || locked || pub.phase !== 'draw'}
        onPick={(c) => {
          setPicked(c);
          send({ t: 'pick', c });
        }}
      />
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </div>
  );
}
