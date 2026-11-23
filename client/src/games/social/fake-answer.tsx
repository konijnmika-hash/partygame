import './social.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, MiniScores, RoundDots, Stage, TextEntry } from '../../game/kit';
import { Avatars, DoneBar, Phase, nm } from './_kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  question: string;
  phase: 'write' | 'pick' | 'reveal';
  deadline: number;
  written: string[];
  options: string[] | null;
  picked: string[];
  reveal: { truth: number; authors: string[][]; picks: Record<string, number> } | null;
  scores: Record<string, number>;
}
interface Priv {
  myFake: string | null;
  myOption: number | null;
  myPick: number | null;
}

export default function FakeAnswer({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const ids = Object.keys(pub.scores);
  const [nope, setNope] = useState<string | null>(null);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'nope') {
      sfx('buzz');
      setNope((ev.data as any).why);
    }
  }, false), []);
  useEffect(() => {
    setNope(null);
  }, [pub.i]);
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.reveal) sfx(priv?.myPick === pub.reveal.truth ? 'correct' : 'lose');
  }, [pub.phase, pub.i]);
  const q = pub.question.replace('____', '_____');
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <div className="g-prompt">{q}</div>
      {pub.phase === 'write' && (
        <>
          <Phase title="Write a believable FAKE answer" sub="Fool the others into picking your lie!" deadline={pub.deadline} total={40000} />
          {priv?.myFake ? <Banner title={`Your lie: “${priv.myFake}”`} sub="Waiting for the other liars..." /> : <TextEntry disabled={!isPlayer} onSubmit={(v) => { setNope(null); send({ t: 'fake', v }); }} placeholder="A convincing fake answer" button="Submit lie" maxLength={32} />}
          {nope && <span className="chip chip-yellow">{nope}</span>}
          <DoneBar players={players} ids={ids} done={pub.written} label="Lies written" />
        </>
      )}
      {pub.options && (
        <>
          {pub.phase === 'pick' && <Phase title="Which one is the TRUTH?" deadline={pub.deadline} total={22000} />}
          <ChoiceGrid
            cols={2}
            choices={pub.options.map((o, i) => ({
              label: o,
              disabled: priv?.myOption === i,
              sub: pub.reveal ? (
                i === pub.reveal.truth ? '✅ THE TRUTH' : <>lie by {pub.reveal.authors[i].length ? pub.reveal.authors[i].map((a) => nm(players, a)).join(' & ') : 'the house'} · fooled <Avatars players={players} ids={Object.entries(pub.reveal.picks).filter(([, c]) => c === i).map(([id]) => id)} size={18} /></>
              ) : priv?.myOption === i ? '(your lie)' : undefined,
            }))}
            picked={priv?.myPick ?? null}
            correct={pub.reveal ? pub.reveal.truth : null}
            wrong={pub.reveal && priv?.myPick != null && priv.myPick !== pub.reveal.truth ? [priv.myPick] : []}
            disabled={!isPlayer || priv?.myPick != null || pub.phase !== 'pick'}
            onPick={(c) => send({ t: 'pick', c })}
          />
          {pub.phase === 'pick' && <DoneBar players={players} ids={ids} done={pub.picked} label="Picked" />}
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
