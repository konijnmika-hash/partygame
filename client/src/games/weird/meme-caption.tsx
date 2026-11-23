import './weird.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, Countdown, MiniScores, RoundDots, TextEntry } from '../../game/kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  k: number;
  n: number;
  phase: 'write' | 'vote' | 'result';
  deadline: number;
  scene: { emoji: string[]; desc: string } | null;
  written: string[];
  entries: { id: string | null; key: string; c: string }[];
  voted: string[];
  tally: Record<string, number> | null;
  scores: Record<string, number>;
}

export default function MemeCaption({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { mine: string | null; myVote: string | null }>) {
  const [vote, setVote] = useState<string | null>(null);
  useEffect(() => {
    setVote(null);
    if (pub.phase === 'vote') sfx('whoosh');
    if (pub.phase === 'result') sfx((pub.tally?.[me] ?? 0) > 0 ? 'cheer' : 'pop');
  }, [pub.phase, pub.k]);
  const myVote = priv?.myVote ?? vote;
  const max = pub.tally ? Math.max(0, ...Object.values(pub.tally)) : 0;
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.k} />
      {pub.scene && (
        <div className="scene-card" key={pub.k}>
          <div className="scene-emoji">{pub.scene.emoji.join('')}</div>
          <b>{pub.scene.desc}</b>
        </div>
      )}
      <Countdown deadline={pub.phase === 'result' ? null : pub.deadline} total={pub.phase === 'write' ? 45000 : 20000} />
      {pub.phase === 'write' && (
        priv?.mine ? <Banner title="Caption submitted! 😹" sub={`“${priv.mine}” — ${pub.written.length}/${players.length} done`} /> : isPlayer ? <TextEntry placeholder="Write the funniest caption…" maxLength={90} button="Submit" onSubmit={(c) => { sfx('pop'); send({ t: 'caption', c }); }} /> : <Banner title="Players are writing…" />
      )}
      {(pub.phase === 'vote' || pub.phase === 'result') && (
        <>
          <Banner title={pub.phase === 'vote' ? 'Vote for the funniest caption!' : 'And the crowd says…'} />
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
                  <span>“{e.c}”</span>
                  {mine && pub.phase === 'vote' && <span className="who">(yours)</span>}
                  {pub.phase === 'result' && (
                    <span className="who">
                      {author && <Avatar avatar={author.avatar} size={22} />}
                      {author?.name} · {n} 🗳️
                    </span>
                  )}
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
