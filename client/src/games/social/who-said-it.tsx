import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, Stage, TextEntry } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { Avatars, DoneBar, Phase, VotePlayers, nm } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  pi: number;
  pn: number;
  prompt: string;
  phase: 'write' | 'guess' | 'reveal';
  deadline: number;
  written: string[];
  qi: number;
  qn: number;
  answer: string | null;
  guessed: string[];
  reveal: { author: string; guesses: Record<string, string> } | null;
  scores: Record<string, number>;
}

export default function WhoSaidIt({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { mine: string | null; isAuthor: boolean; myGuess: string | null }>) {
  const ids = Object.keys(pub.scores);
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.reveal) sfx(pub.reveal.guesses[me] === pub.reveal.author ? 'correct' : 'blip');
  }, [pub.phase, pub.qi]);
  return (
    <Stage>
      <Phase title={pub.prompt} sub={`Prompt ${pub.pi + 1} of ${pub.pn}${pub.phase !== 'write' ? ` · answer ${pub.qi + 1}/${pub.qn}` : ''}`} deadline={pub.phase !== 'reveal' ? pub.deadline : null} total={pub.phase === 'write' ? 40000 : 12000} />
      {pub.phase === 'write' && (
        <>
          {priv?.mine ? <Banner title={`“${priv.mine}”`} sub="Answer locked — act natural 😇" /> : <TextEntry disabled={!isPlayer} onSubmit={(v) => send({ t: 'answer', v })} placeholder="Your anonymous answer" button="Submit" maxLength={90} />}
          <DoneBar players={players} ids={ids} done={pub.written} label="Written" />
        </>
      )}
      {pub.phase !== 'write' && pub.answer && (
        <>
          <div className="quote-card anim-pop" key={pub.qi}>“{pub.answer}”</div>
          {pub.phase === 'guess' ? (
            priv?.isAuthor ? (
              <Banner title="That's yours! 🤫" sub="Keep a straight face..." />
            ) : (
              <>
                <Banner title="Who wrote this?" />
                <VotePlayers players={players} ids={ids} exclude={[me]} picked={priv?.myGuess} disabled={!isPlayer || !!priv?.myGuess} onPick={(id) => send({ t: 'guess', target: id })} />
              </>
            )
          ) : (
            pub.reveal && (
              <div className="stack" style={{ alignItems: 'center' }}>
                {player(pub.reveal.author) && <Avatar avatar={player(pub.reveal.author)!.avatar} size={86} bob mood="happy" />}
                <Banner title={`${nm(players, pub.reveal.author)} said it!`} sub={<>Guessed right: <Avatars players={players} ids={Object.entries(pub.reveal.guesses).filter(([, t]) => t === pub.reveal!.author).map(([g]) => g)} /></>} tone="good" />
              </div>
            )
          )}
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
