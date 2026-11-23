import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, RoundDots, Stage, TextEntry } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { Chat } from '../../screens/RoomScreen';
import { Avatars, DoneBar, Phase, VotePlayers, nm } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  phase: 'answer' | 'discuss' | 'vote' | 'reveal';
  deadline: number;
  answered: string[];
  answers: Record<string, string> | null;
  crewQuestion: string | null;
  voted: string[];
  outcome: { impostor: string; caught: boolean; counts: Record<string, number>; impostorQuestion: string; votes: Record<string, string> } | null;
  scores: Record<string, number>;
}
interface Priv {
  question: string;
  myAnswer: string | null;
  myVote: string | null;
  wasImpostor: boolean | null;
}

export default function SecretImpostor({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, Priv>) {
  const ids = Object.keys(pub.scores);
  useEffect(() => {
    if (pub.phase === 'reveal') sfx(pub.outcome?.caught ? 'win' : 'lose');
  }, [pub.phase, pub.round]);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.round} />
      {pub.phase === 'answer' && (
        <>
          <Phase title="Answer your question" sub="Careful... one of you got a DIFFERENT question." deadline={pub.deadline} total={30000} />
          <div className="g-prompt">{priv?.question ?? '...'}</div>
          {priv?.myAnswer ? <Banner title={`You said: “${priv.myAnswer}”`} sub="Waiting for the others" /> : <TextEntry disabled={!isPlayer} onSubmit={(v) => send({ t: 'answer', v })} placeholder="Your answer" button="Lock in" maxLength={40} />}
          <DoneBar players={players} ids={ids} done={pub.answered} label="Answered" />
        </>
      )}
      {(pub.phase === 'discuss' || pub.phase === 'vote') && pub.answers && (
        <>
          <Phase title={pub.phase === 'discuss' ? 'Discuss! Who answered something else?' : 'Vote for the Impostor!'} sub={<>The real question was: <b>{pub.crewQuestion}</b></>} deadline={pub.deadline} total={pub.phase === 'discuss' ? 22000 : 16000} />
          <div className="answers-list">
            {ids.map((id) => {
              const p = player(id);
              return (
                <div key={id} className="ans-row">
                  {p && <Avatar avatar={p.avatar} size={36} />}
                  <b>{p?.name}</b>
                  <span className="ans-text">“{pub.answers![id]}”</span>
                </div>
              );
            })}
          </div>
          {pub.phase === 'discuss' ? (
            <div className="discuss-wrap">
              <Chat className="game-chat" />
              <button className="btn btn-yellow" disabled={!isPlayer} onClick={() => send({ t: 'ready' })}>Ready to vote</button>
            </div>
          ) : (
            <>
              <VotePlayers players={players} ids={ids} exclude={[me]} picked={priv?.myVote} disabled={!isPlayer || !!priv?.myVote} onPick={(id) => send({ t: 'vote', target: id })} />
              <DoneBar players={players} ids={ids} done={pub.voted} label="Voted" />
            </>
          )}
        </>
      )}
      {pub.phase === 'reveal' && pub.outcome && (
        <div className="stack" style={{ alignItems: 'center' }}>
          {player(pub.outcome.impostor) && <Avatar avatar={player(pub.outcome.impostor)!.avatar} size={96} bob mood={pub.outcome.caught ? 'sad' : 'happy'} />}
          <Banner title={`${nm(players, pub.outcome.impostor)} was the Impostor!`} sub={pub.outcome.caught ? 'Caught! 🚨' : 'They got away with it! 😈'} tone={pub.outcome.caught ? 'good' : 'bad'} big />
          <div className="g-prompt small-prompt"><small>The impostor's question</small>{pub.outcome.impostorQuestion}</div>
          <div className="row" style={{ justifyContent: 'center' }}>
            {Object.entries(pub.outcome.counts).map(([id, n]) => <span key={id} className="chip chip-dark">{nm(players, id)}: {n} votes <Avatars players={players} ids={Object.entries(pub.outcome!.votes).filter(([, t]) => t === id).map(([v]) => v)} size={18} /></span>)}
          </div>
          {priv?.wasImpostor && <span className="chip chip-pink">Plot twist: YOU were the impostor!</span>}
        </div>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
