import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { MiniScores, RoundDots, Stage } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { DoneBar, Phase, VotePlayers, nm } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  prompt: string;
  phase: 'vote' | 'reveal';
  deadline: number;
  voted: string[];
  reveal: { counts: Record<string, number>; winners: string[]; votes: Record<string, string> } | null;
  scores: Record<string, number>;
  famous: Record<string, number>;
}

export default function MostLikely({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { myVote: string | null }>) {
  const ids = Object.keys(pub.scores);
  useEffect(() => {
    if (pub.phase === 'reveal') sfx(pub.reveal?.winners.includes(priv?.myVote ?? '') ? 'correct' : 'cheer');
  }, [pub.phase, pub.i]);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <Phase title={<>Who is most likely to <span className="hl">{pub.prompt}</span>?</>} deadline={pub.phase === 'vote' ? pub.deadline : null} total={14000} />
      {pub.phase === 'vote' ? (
        <>
          <VotePlayers players={players} ids={ids} exclude={[me]} picked={priv?.myVote} disabled={!isPlayer || !!priv?.myVote} onPick={(id) => send({ t: 'vote', target: id })} />
          <DoneBar players={players} ids={ids} done={pub.voted} label="Voted" />
        </>
      ) : (
        pub.reveal && (
          <div className="ml-results">
            {pub.reveal.winners.length > 0 && (
              <div className="ml-winner anim-pop">
                <div className="row" style={{ justifyContent: 'center' }}>
                  {pub.reveal.winners.slice(0, 5).map((w) => player(w) && <Avatar key={w} avatar={player(w)!.avatar} size={pub.reveal!.winners.length > 2 ? 64 : 96} bob mood="happy" />)}
                </div>
                <div className="soc-title">{pub.reveal.winners.length > 3 ? `${pub.reveal.winners.length}-way tie!` : `${pub.reveal.winners.map((w) => nm(players, w)).join(' & ')}!`}</div>
              </div>
            )}
            <div className="ml-bars">
              {Object.entries(pub.reveal.counts).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                <div key={id} className="ml-bar">
                  <span className="ml-name">{nm(players, id)}</span>
                  <span className="ml-fill" style={{ width: `${(n / Math.max(1, ids.length - 1)) * 100}%` }}>{n}</span>
                </div>
              ))}
            </div>
            {priv?.myVote && <span className={`chip ${pub.reveal.winners.includes(priv.myVote) ? 'chip-green' : 'chip-dark'}`}>{pub.reveal.winners.includes(priv.myVote) ? 'You matched the majority! +100' : `You picked ${nm(players, priv.myVote)}`}</span>}
          </div>
        )
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
