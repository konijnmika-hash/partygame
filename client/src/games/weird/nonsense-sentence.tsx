import './weird.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, Countdown, MiniScores, RoundDots } from '../../game/kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  r: number;
  n: number;
  phase: 'play' | 'vote' | 'result';
  deadline: number;
  prompt: string;
  playedBy: string[];
  entries: { key: string; id: string | null; card: string }[];
  voted: string[];
  tally: Record<string, number> | null;
  scores: Record<string, number>;
}

function Sentence({ prompt, fill }: { prompt: string; fill?: string }) {
  const [a, b] = prompt.split('___');
  return (
    <span>
      {a}
      {fill ? <b className="hl-word">{fill}</b> : <span className="blank">&nbsp;</span>}
      {b}
    </span>
  );
}

export default function NonsenseSentence({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { hand: string[]; mine: string | null; myVote: string | null }>) {
  const [vote, setVote] = useState<string | null>(null);
  useEffect(() => {
    setVote(null);
    if (pub.phase === 'vote') sfx('whoosh');
    if (pub.phase === 'result') sfx((pub.tally?.[me] ?? 0) > 0 ? 'cheer' : 'pop');
  }, [pub.phase, pub.r]);
  const myVote = priv?.myVote ?? vote;
  const max = pub.tally ? Math.max(0, ...Object.values(pub.tally)) : 0;
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.r} />
      <div className="g-prompt"><Sentence prompt={pub.prompt} fill={pub.phase === 'play' ? priv?.mine ?? undefined : undefined} /></div>
      <Countdown deadline={pub.phase === 'result' ? null : pub.deadline} total={pub.phase === 'play' ? 25000 : 18000} />
      {pub.phase === 'play' && (
        priv?.mine ? (
          <Banner title="Card played! 🃏" sub={`${pub.playedBy.length}/${players.length} played`} />
        ) : (
          <>
            <Banner title="Play your silliest card" />
            <div className="hand">
              {(priv?.hand ?? []).map((c, i) => (
                <button key={`${c}-${i}`} className="card" disabled={!isPlayer} onClick={() => { sfx('swap'); send({ t: 'play', i }); }}>{c}</button>
              ))}
            </div>
          </>
        )
      )}
      {(pub.phase === 'vote' || pub.phase === 'result') && (
        <>
          <Banner title={pub.phase === 'vote' ? 'Vote for the best one!' : 'Results'} />
          <div className="entries">
            {pub.entries.map((e) => {
              const mine = e.key === me;
              const n = pub.tally?.[e.key] ?? 0;
              const author = e.id ? player(e.id) : null;
              return (
                <button
                  key={e.key}
                  className={`entry ${mine ? 'mine' : ''} ${myVote === e.key ? 'on' : ''} ${pub.phase === 'result' && n === max && max > 0 ? 'win' : ''}`}
                  disabled={!isPlayer || pub.phase !== 'vote' || mine || !!myVote}
                  onClick={() => { setVote(e.key); sfx('tap'); send({ t: 'vote', target: e.key }); }}
                >
                  <Sentence prompt={pub.prompt} fill={e.card} />
                  {pub.phase === 'result' && <span className="who">{author && <Avatar avatar={author.avatar} size={22} />}{n} 🗳️</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </div>
  );
}
