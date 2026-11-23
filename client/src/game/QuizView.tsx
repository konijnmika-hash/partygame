// Generic multiple-choice view for games built on the server quiz engine.
import { useEffect, useState, type ReactNode } from 'react';
import type { GameViewProps } from './types';
import { ChoiceGrid, Countdown, MiniScores, RoundDots, Stage } from './kit';
import { Avatar } from '../components/ui';
import { sfx } from '../audio/sfx';

export interface QuizPub<P = any, C = any> {
  i: number;
  n: number;
  phase: 'q' | 'reveal';
  q: { prompt: P; choices: C[] } | null;
  shownAt: number;
  deadline: number;
  answered: string[];
  reveal: { answer: number; picks: Record<string, number>; gains: Record<string, number>; explain: string | null } | null;
  scores: Record<string, number>;
  streak: Record<string, number>;
  wager: boolean;
}

export function QuizView<P, C>({ pub, priv, me, isPlayer, send, players, renderPrompt, renderChoice, cols }: GameViewProps<QuizPub<P, C>, { mine: { c: number; w: number } | null }> & {
  renderPrompt: (p: P) => ReactNode;
  renderChoice?: (c: C, i: number) => ReactNode;
  cols?: number;
}) {
  const [wager, setWager] = useState(2);
  const mine = priv?.mine;
  const q = pub.q;
  const rev = pub.reveal;
  useEffect(() => {
    if (!rev) return;
    const g = rev.gains[me];
    if (g == null) return;
    sfx(g > 0 ? 'correct' : 'wrong');
  }, [rev?.answer, pub.i]);
  if (!q) return null;
  const pickedBy = (i: number) => (rev ? Object.entries(rev.picks).filter(([, c]) => c === i).map(([id]) => id) : []);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <Countdown deadline={pub.phase === 'q' ? pub.deadline : null} total={pub.deadline - pub.shownAt} />
      <div className="g-col">
        <div className="anim-pop" key={pub.i}>{renderPrompt(q.prompt)}</div>
        {pub.wager && pub.phase === 'q' && !mine && isPlayer && (
          <div className="wager-row">
            <span className="small">Confidence:</span>
            {[1, 2, 3].map((w) => (
              <button key={w} className={`wager ${wager === w ? 'on' : ''}`} onClick={() => { setWager(w); sfx('select'); }}>
                {'🪙'.repeat(w)}
              </button>
            ))}
          </div>
        )}
        <ChoiceGrid
          cols={cols}
          choices={q.choices.map((c, i) => ({
            label: renderChoice ? renderChoice(c, i) : String(c),
            sub: rev ? (
              <span className="pick-avatars">
                {pickedBy(i).slice(0, 6).map((id) => {
                  const p = players.find((x) => x.id === id);
                  return p ? <Avatar key={id} avatar={p.avatar} size={20} /> : null;
                })}
              </span>
            ) : undefined,
          }))}
          picked={mine?.c ?? null}
          correct={rev ? rev.answer : null}
          wrong={rev && mine && mine.c !== rev.answer ? [mine.c] : []}
          disabled={!isPlayer || !!mine || pub.phase !== 'q'}
          onPick={(i) => send({ t: 'pick', c: i, w: wager })}
        />
        <div className="g-row">
          {pub.phase === 'q' && mine && <span className="chip chip-dark">Locked in{pub.wager ? ` · wager ${mine.w}` : ''} — {pub.answered.length}/{players.filter((p) => p.status === 'playing').length || pub.answered.length} answered</span>}
          {rev && rev.gains[me] != null && <span className={`chip ${rev.gains[me] > 0 ? 'chip-green' : 'chip-red'}`}>{rev.gains[me] > 0 ? `+${rev.gains[me]}` : rev.gains[me]}</span>}
          {rev && rev.gains[me] == null && pub.phase === 'reveal' && <span className="chip chip-dark">No answer</span>}
          {(pub.streak[me] ?? 0) >= 2 && <span className="chip chip-yellow">🔥 {pub.streak[me]} streak</span>}
          {rev?.explain && <span className="chip">{rev.explain}</span>}
        </div>
      </div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </Stage>
  );
}
