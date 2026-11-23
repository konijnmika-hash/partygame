import './weird.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, ChoiceGrid, Countdown, MiniScores } from '../../game/kit';
import { nm } from '../social/_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  phase: 'compose' | 'guess' | 'reveal';
  deadline: number;
  palette: string[];
  max: number;
  submitted: string[];
  k: number;
  n: number;
  teller: string | null;
  story: string[] | null;
  options: string[];
  answered: string[];
  answer: number | null;
  picks: Record<string, number> | null;
  scores: Record<string, number>;
}

export default function EmojiStory({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { title: string; mine: number[] | null; myPick: number | null }>) {
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => {
    if (pub.phase === 'reveal' && priv?.myPick != null) sfx(priv.myPick === pub.answer ? 'correct' : 'wrong');
    if (pub.phase === 'guess') sfx('whoosh');
  }, [pub.phase, pub.k]);
  if (pub.phase === 'compose') {
    const done = !!priv?.mine;
    return (
      <div className="g-stage">
        <div className="g-prompt"><small>Your secret story</small>{priv?.title}</div>
        <Countdown deadline={pub.deadline} total={45000} />
        {done ? (
          <>
            <Banner title="Story sent! 📖" sub={`${pub.submitted.length}/${players.length} storytellers ready`} />
            <div className="emoji-strip">{priv!.mine!.map((i) => pub.palette[i]).join(' ')}</div>
          </>
        ) : (
          <>
            <Banner title={`Tell it with up to ${pub.max} emoji`} sub="Tap an emoji to add it, tap it in the strip to remove it" />
            <div className="emoji-strip">
              {sel.length ? sel.map((i, k) => <button key={k} onClick={() => setSel(sel.filter((_, j) => j !== k))}>{pub.palette[i]}</button>) : <span className="small">…</span>}
            </div>
            <div className="emoji-palette">
              {pub.palette.map((e, i) => (
                <button key={i} disabled={!isPlayer || sel.length >= pub.max} onClick={() => { setSel([...sel, i]); sfx('tap', 1 + sel.length * 0.08); }}>{e}</button>
              ))}
            </div>
            <button className="btn btn-green" disabled={!isPlayer || !sel.length} onClick={() => { sfx('select'); send({ t: 'story', e: sel }); }}>Send my story</button>
          </>
        )}
      </div>
    );
  }
  const teller = pub.teller ? player(pub.teller) : null;
  const mineStory = pub.teller === me;
  return (
    <div className="g-stage">
      <div className="small">Story {pub.k + 1}/{pub.n}</div>
      <div className="row-nw" style={{ gap: 8 }}>
        {teller && <Avatar avatar={teller.avatar} size={34} />}
        <b>{mineStory ? 'Your story!' : `${teller?.name ?? '…'}'s story`}</b>
      </div>
      <div className="story-big" key={pub.k}>{pub.story?.join(' ')}</div>
      <Countdown deadline={pub.phase === 'guess' ? pub.deadline : null} total={15000} />
      <ChoiceGrid
        compact
        cols={1}
        choices={pub.options.map((o) => ({ label: o }))}
        picked={priv?.myPick ?? null}
        correct={pub.answer}
        wrong={pub.answer != null && priv?.myPick != null && priv.myPick !== pub.answer ? [priv.myPick] : []}
        disabled={!isPlayer || mineStory || priv?.myPick != null || pub.phase !== 'guess'}
        onPick={(c) => send({ t: 'pick', c })}
      />
      {mineStory && pub.phase === 'guess' && <Banner title="Can they read your emoji? 🤞" />}
      {pub.phase === 'reveal' && pub.picks && (
        <div className="small">
          Got it: {Object.entries(pub.picks).filter(([, c]) => c === pub.answer).map(([id]) => nm(players, id)).join(', ') || 'nobody 😅'}
        </div>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </div>
  );
}
