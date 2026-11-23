import './puzzle.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, MiniScores, RoundDots, Stage } from '../../game/kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'play' | 'reveal';
  clues: string[];
  totalClues: number;
  choices: { name: string; emoji: string }[];
  guessed: string[];
  reveal: { answer: number; picks: Record<string, { c: number; ok: boolean; pts: number }> } | null;
  scores: Record<string, number>;
}

export default function MysteryBox({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: { c: number; ok: boolean; pts: number } | null }>) {
  const mine = priv?.mine;
  useEffect(() => {
    if (pub.clues.length > 1) sfx('blip');
  }, [pub.clues.length]);
  useEffect(() => {
    if (pub.reveal && mine) sfx(mine.ok ? 'correct' : 'wrong');
  }, [!!pub.reveal]);
  const worth = 30 + (6 - pub.clues.length) * 28;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <div className="mb-top">
        <div className={`mb-box ${pub.reveal ? 'open' : ''}`} key={pub.i}>{pub.reveal ? pub.choices[pub.reveal.answer].emoji : '🎁'}</div>
        <div className="mb-clues">
          {pub.clues.map((c, i) => (
            <div key={i} className="mb-clue anim-up"><b>{i + 1}.</b> {c}</div>
          ))}
          {pub.phase === 'play' && pub.clues.length < pub.totalClues && <div className="mb-clue dim">Next clue coming...</div>}
        </div>
      </div>
      {pub.reveal ? (
        <Banner title={`It was: ${pub.choices[pub.reveal.answer].name}!`} sub={mine ? (mine.ok ? `+${mine.pts} points` : 'Wrong guess') : 'No guess'} tone={mine?.ok ? 'good' : 'info'} />
      ) : (
        <Banner title={mine ? 'Guess locked 🔒' : `Guess now for ${worth} pts`} sub="Only ONE guess per box" />
      )}
      <ChoiceGrid
        cols={4}
        compact
        choices={pub.choices.map((c) => ({ label: <><span style={{ fontSize: '1.7rem' }}>{c.emoji}</span><span style={{ fontSize: '0.85rem' }}>{c.name}</span></> }))}
        picked={mine?.c ?? null}
        correct={pub.reveal?.answer ?? null}
        wrong={pub.reveal && mine && !mine.ok ? [mine.c] : []}
        disabled={!isPlayer || !!mine || pub.phase !== 'play'}
        onPick={(c) => send({ t: 'guess', c })}
      />
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
