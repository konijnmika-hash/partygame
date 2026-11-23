import './social.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, MiniScores, Stage } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { Avatars, DoneBar, Phase, nm } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  phase: 'write' | 'vote' | 'reveal';
  deadline: number;
  submitted: string[];
  author: string | null;
  idx: number;
  total: number;
  statements: string[] | null;
  voted: string[];
  reveal: { lie: number; votes: Record<string, number> } | null;
  scores: Record<string, number>;
}

export default function TwoTruths({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { submitted: boolean; myVote: number | null }>) {
  const [lines, setLines] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  useEffect(() => {
    if (pub.phase === 'reveal') sfx(pub.reveal && priv?.myVote === pub.reveal.lie ? 'correct' : 'blip');
  }, [pub.phase, pub.idx]);
  const ids = Object.keys(pub.scores);
  if (pub.phase === 'write') {
    if (priv?.submitted || !isPlayer) {
      return (
        <Stage className="centered">
          <Banner title="Statements locked in! 🔒" sub="Waiting for everyone else..." />
          <DoneBar players={players} ids={ids} done={pub.submitted} label="Written" />
        </Stage>
      );
    }
    const ok = lines.every((l) => l.trim().length >= 2) && lie != null;
    return (
      <Stage>
        <Phase title="Write 2 truths and 1 lie" sub="About yourself! Then mark which one is the lie." deadline={pub.deadline} total={75000} />
        <div className="g-col tt-form">
          {lines.map((l, i) => (
            <div key={i} className={`tt-line ${lie === i ? 'lie' : ''}`}>
              <input className="input" value={l} maxLength={90} placeholder={i === 1 ? 'e.g. I once met a penguin' : `Statement ${i + 1}`} onChange={(e) => setLines(lines.map((x, k) => (k === i ? e.target.value : x)))} />
              <button className={`btn btn-sm ${lie === i ? 'btn-red' : 'btn-ghost'}`} onClick={() => { setLie(i); sfx('select'); }}>{lie === i ? '🤥 Lie' : 'Lie?'}</button>
            </div>
          ))}
          <button className="btn btn-green btn-lg" disabled={!ok} onClick={() => send({ t: 'submit', s: lines.map((l) => l.trim()), lie })}>Lock it in</button>
        </div>
      </Stage>
    );
  }
  const author = pub.author!;
  const mine = author === me;
  const a = player(author);
  const votesFor = (i: number) => (pub.reveal ? Object.entries(pub.reveal.votes).filter(([, c]) => c === i).map(([id]) => id) : []);
  return (
    <Stage>
      <Phase title={mine ? 'Everyone is judging YOU 😅' : `Which is ${nm(players, author)}'s lie?`} sub={`Player ${pub.idx + 1} of ${pub.total}`} deadline={pub.phase === 'vote' ? pub.deadline : null} total={16000} />
      {a && <Avatar avatar={a.avatar} size={74} bob />}
      <ChoiceGrid
        cols={1}
        choices={(pub.statements ?? []).map((st, i) => ({ label: st, sub: pub.reveal ? <><Avatars players={players} ids={votesFor(i)} /> {i === pub.reveal.lie ? '🤥 THE LIE' : '✅ true'}</> : undefined }))}
        picked={priv?.myVote ?? null}
        correct={pub.reveal ? pub.reveal.lie : null}
        disabled={!isPlayer || mine || priv?.myVote != null || pub.phase !== 'vote'}
        onPick={(c) => send({ t: 'vote', c })}
      />
      {pub.phase === 'vote' && <DoneBar players={players} ids={ids.filter((id) => id !== author)} done={pub.voted} label="Voted" />}
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </Stage>
  );
}
