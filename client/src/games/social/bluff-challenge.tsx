import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, RoundDots, Stage } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { Avatars, DoneBar, Phase, nm } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  turn: number;
  n: number;
  presenter: string;
  phase: 'claim' | 'vote' | 'reveal';
  deadline: number;
  statement: string | null;
  claim: boolean | null;
  voted: string[];
  reveal: { truth: boolean; votes: Record<string, 'believe' | 'doubt'> } | null;
  scores: Record<string, number>;
}
interface Priv {
  presenter: boolean;
  statement: string | null;
  truth: boolean | null;
  myVote: 'believe' | 'doubt' | null;
}

export default function BluffChallenge({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, Priv>) {
  const ids = Object.keys(pub.scores);
  const pres = player(pub.presenter);
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.reveal && priv?.myVote) {
      const honest = pub.claim === pub.reveal.truth;
      sfx((priv.myVote === 'believe') === honest ? 'correct' : 'wrong');
    }
  }, [pub.phase, pub.turn]);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.turn} />
      <div className="presenter">
        {pres && <Avatar avatar={pres.avatar} size={70} bob />}
        <b>{pub.presenter === me ? 'You are presenting!' : `${nm(players, pub.presenter)} presents...`}</b>
      </div>
      {pub.phase === 'claim' && (
        priv?.presenter ? (
          <>
            <Phase title="Your secret statement" sub="Tell the truth... or bluff!" deadline={pub.deadline} total={12000} />
            <div className="quote-card">{priv.statement}</div>
            <div className={`truth-tag ${priv.truth ? 'true' : 'false'}`}>It is actually {priv.truth ? 'TRUE ✅' : 'FALSE ❌'}</div>
            <div className="g-row">
              <button className="btn btn-green btn-lg" onClick={() => send({ t: 'claim', v: true })}>Claim it's TRUE</button>
              <button className="btn btn-red btn-lg" onClick={() => send({ t: 'claim', v: false })}>Claim it's FALSE</button>
            </div>
          </>
        ) : (
          <Banner title="🤔 Deciding whether to bluff..." sub="Get your detective face ready" />
        )
      )}
      {pub.phase !== 'claim' && pub.statement && (
        <>
          <div className="quote-card">{pub.statement}</div>
          <div className={`claim-tag ${pub.claim ? 'true' : 'false'}`}>{nm(players, pub.presenter)} says: {pub.claim ? 'TRUE' : 'FALSE'}</div>
          {pub.phase === 'vote' && pub.presenter !== me && (
            <div className="g-row">
              <button className={`btn btn-lg ${priv?.myVote === 'believe' ? 'btn-green' : 'btn-white'}`} disabled={!isPlayer || !!priv?.myVote} onClick={() => send({ t: 'vote', v: 'believe' })}>👍 Believe</button>
              <button className={`btn btn-lg ${priv?.myVote === 'doubt' ? 'btn-red' : 'btn-white'}`} disabled={!isPlayer || !!priv?.myVote} onClick={() => send({ t: 'vote', v: 'doubt' })}>🤨 Doubt</button>
            </div>
          )}
          {pub.phase === 'vote' && <DoneBar players={players} ids={ids.filter((id) => id !== pub.presenter)} done={pub.voted} label="Voted" />}
          {pub.reveal && (
            <div className="stack" style={{ alignItems: 'center' }}>
              <Banner title={`It was ${pub.reveal.truth ? 'TRUE' : 'FALSE'}!`} sub={pub.claim === pub.reveal.truth ? `${nm(players, pub.presenter)} told the truth` : `${nm(players, pub.presenter)} was BLUFFING! 🃏`} tone={pub.claim === pub.reveal.truth ? 'info' : 'warn'} big />
              <div className="row">
                <span className="chip chip-green">👍 <Avatars players={players} ids={Object.entries(pub.reveal.votes).filter(([, v]) => v === 'believe').map(([id]) => id)} /></span>
                <span className="chip chip-red">🤨 <Avatars players={players} ids={Object.entries(pub.reveal.votes).filter(([, v]) => v === 'doubt').map(([id]) => id)} /></span>
              </div>
            </div>
          )}
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
