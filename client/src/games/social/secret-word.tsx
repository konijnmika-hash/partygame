import './social.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, RoundDots, Stage, TextEntry } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { DoneBar, Phase, VotePlayers, nm } from './_kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  phase: 'clue' | 'vote' | 'spyguess' | 'reveal';
  deadline: number;
  category: string;
  words: string[];
  cluesGiven: string[];
  clues: Record<string, string> | null;
  voted: string[];
  caughtSpy: string | null;
  reveal: { spy: string; word: number; votes: Record<string, string>; caught: boolean; spyGuess: number | null } | null;
  scores: Record<string, number>;
}
interface Priv {
  isSpy: boolean;
  word: number | null;
  myClue: string | null;
  myVote: string | null;
}

export default function SecretWord({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, Priv>) {
  const ids = Object.keys(pub.scores);
  const [nope, setNope] = useState<string | null>(null);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'nope') {
      sfx('wrong');
      setNope((ev.data as any).why);
    }
  }, false), []);
  useEffect(() => {
    if (pub.phase === 'reveal') sfx(pub.reveal?.caught ? 'win' : 'lose');
  }, [pub.phase, pub.round]);
  const spy = priv?.isSpy;
  const canSpyGuess = pub.phase === 'spyguess' && pub.caughtSpy === me;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.round} />
      <div className={`role-card ${spy ? 'spy' : ''}`}>
        <span>{spy ? <>🕵️ You are the <b>SPY</b>! Blend in and work out the word.</> : <>🤫 The secret word is <b>{priv?.word != null ? pub.words[priv.word] : '...'}</b></>}</span>
      </div>
      <Phase
        title={pub.phase === 'clue' ? 'Give a one-word clue' : pub.phase === 'vote' ? 'Who is the spy?' : pub.phase === 'spyguess' ? `${nm(players, pub.caughtSpy)} was caught! Guessing the word...` : 'Reveal'}
        sub={`Category: ${pub.category}`}
        deadline={pub.phase !== 'reveal' ? pub.deadline : null}
        total={pub.phase === 'clue' ? 35000 : 20000}
      />
      <div className="word-grid">
        {pub.words.map((w, i) => (
          <button
            key={w}
            className={`wg-cell ${!spy && priv?.word === i ? 'secret' : ''} ${pub.reveal?.word === i ? 'secret' : ''} ${pub.reveal?.spyGuess === i ? 'guess' : ''}`}
            disabled={!canSpyGuess}
            onClick={() => send({ t: 'spyguess', c: i })}
          >
            {w}
          </button>
        ))}
      </div>
      {pub.phase === 'clue' && (
        <>
          {priv?.myClue ? <Banner title={`Your clue: ${priv.myClue}`} sub="Waiting for the others" /> : <TextEntry disabled={!isPlayer} onSubmit={(v) => { setNope(null); send({ t: 'clue', v }); }} placeholder="One word..." button="Give clue" maxLength={24} />}
          {nope && <span className="chip chip-red">{nope}</span>}
          <DoneBar players={players} ids={ids} done={pub.cluesGiven} label="Clues" />
        </>
      )}
      {pub.clues && (
        <div className="clue-list">
          {ids.map((id) => (
            <span key={id} className={`clue-chip ${pub.reveal?.spy === id ? 'spy' : ''}`}>
              {player(id) && <Avatar avatar={player(id)!.avatar} size={24} />} <b>{nm(players, id)}</b> “{pub.clues![id]}”
            </span>
          ))}
        </div>
      )}
      {pub.phase === 'vote' && <VotePlayers players={players} ids={ids} exclude={[me]} picked={priv?.myVote} disabled={!isPlayer || !!priv?.myVote} onPick={(id) => send({ t: 'vote', target: id })} />}
      {pub.phase === 'reveal' && pub.reveal && (
        <Banner
          title={`${nm(players, pub.reveal.spy)} was the spy!`}
          sub={!pub.reveal.caught ? 'The spy escaped! 🕶️' : pub.reveal.spyGuess === pub.reveal.word ? 'Caught... but they guessed the word! 😱' : 'Caught, and the word stayed secret! 🎉'}
          tone={pub.reveal.caught && pub.reveal.spyGuess !== pub.reveal.word ? 'good' : 'bad'}
        />
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
