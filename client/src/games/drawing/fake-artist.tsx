import './drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { PALETTE } from '@shared/palette';
import { DrawCanvas } from '../../game/DrawCanvas';
import { Banner, Countdown, MiniScores, TextEntry } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { VotePlayers, nm } from '../social/_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  category: string;
  order: string[];
  turn: number;
  total: number;
  current: string | null;
  phase: 'draw' | 'vote' | 'guess' | 'reveal';
  deadline: number;
  colors: Record<string, number>;
  voted: string[];
  caughtFake: string | null;
  reveal: { fake: string; word: string; votes: Record<string, string>; caught: boolean; guess: string | null; right: boolean } | null;
  scores: Record<string, number>;
}

export default function FakeArtist({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { isFake: boolean; word: string | null; myVote: string | null }>) {
  const myTurn = pub.phase === 'draw' && pub.current === me;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (myTurn) sfx('ding');
  }, [pub.turn, myTurn]);
  useEffect(() => {
    if (pub.phase === 'reveal') sfx(pub.reveal?.caught && !pub.reveal.right ? 'win' : 'lose');
  }, [pub.phase]);
  return (
    <div className="g-stage">
      <div className={`role-card ${priv?.isFake ? 'spy' : ''}`}>
        <span>{priv?.isFake ? <>🎭 You are the <b>FAKE ARTIST</b>! Category: <b>{pub.category}</b> — fake it!</> : <>🖌️ The word is <b>{priv?.word}</b> ({pub.category})</>}</span>
      </div>
      <div className="fa-turns">
        {pub.order.map((id, i) => (
          <span key={id} className={`fa-turn ${pub.current === id ? 'now' : ''}`} style={{ borderColor: PALETTE[pub.colors[id]] }}>
            {player(id) && <Avatar avatar={player(id)!.avatar} size={26} />}
            <i style={{ background: PALETTE[pub.colors[id]] }} />
            {i === 0 ? null : null}
          </span>
        ))}
      </div>
      {pub.phase === 'draw' && (
        <>
          <Banner title={myTurn ? (drawn ? 'Nice stroke! ✓' : 'Your turn: draw ONE line!') : `${nm(players, pub.current)} is drawing...`} sub={`Stroke ${pub.turn + 1} of ${pub.total}`} tone={myTurn ? 'warn' : 'default'} />
          <Countdown deadline={pub.deadline} total={16000} />
        </>
      )}
      <DrawCanvas
        cv="fa"
        me={me}
        editable={isPlayer && myTurn && !drawn}
        send={send}
        toolbar={false}
        limitColors={[pub.colors[me] ?? 0]}
        maxStrokes={1}
        onStrokeEnd={() => {
          setDrawn(true);
          send({ t: 'done' });
        }}
      />
      {pub.phase === 'vote' && (
        <>
          <Banner title="Who is the Fake Artist?" />
          <Countdown deadline={pub.deadline} total={25000} />
          <VotePlayers players={players} ids={pub.order} exclude={[me]} picked={priv?.myVote} disabled={!isPlayer || !!priv?.myVote} onPick={(id) => send({ t: 'vote', target: id })} />
        </>
      )}
      {pub.phase === 'guess' && (
        pub.caughtFake === me ? (
          <>
            <Banner title="Caught! 😱 Guess the word to steal the win" sub={`Category: ${pub.category}`} />
            <TextEntry disabled={!isPlayer} onSubmit={(g) => send({ t: 'guess', g })} placeholder="The secret word is..." button="Guess" />
          </>
        ) : (
          <Banner title={`${nm(players, pub.caughtFake)} was caught!`} sub="Can they guess the word?" />
        )
      )}
      {pub.phase === 'reveal' && pub.reveal && (
        <Banner
          title={`${nm(players, pub.reveal.fake)} was the Fake Artist!`}
          sub={!pub.reveal.caught ? 'They escaped! 🎭' : pub.reveal.right ? `...and guessed “${pub.reveal.word}”! 😱` : `The word was “${pub.reveal.word}” — artists win! 🎨`}
          tone={pub.reveal.caught && !pub.reveal.right ? 'good' : 'bad'}
        />
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </div>
  );
}
