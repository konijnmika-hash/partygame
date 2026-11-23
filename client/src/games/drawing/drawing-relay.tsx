import './drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DrawCanvas, StrokesView } from '../../game/DrawCanvas';
import { Banner, Countdown, MiniScores, TextEntry } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { DoneBar } from '../social/_kit';
import { asStrokes } from './_shared';
import { sfx } from '../../audio/sfx';

interface Pub {
  k: number;
  steps: number;
  kind: 'text' | 'draw' | null;
  phase: 'step' | 'vote' | 'reveal';
  deadline: number;
  submitted: string[];
  voted: string[];
  reveal: Record<string, number> | null;
  scores: Record<string, number>;
  starters: string[];
}
interface Priv {
  myChain: number;
  chain?: number;
  cv?: string;
  submitted?: boolean;
  prevText?: string | null;
  prevKey?: string | null;
}
interface Step {
  kind: 'text' | 'draw';
  by: string;
  text?: string;
  strokes?: any[];
}

export default function DrawingRelay({ pub, priv, me, isPlayer, send, players, player, assets }: GameViewProps<Pub, Priv>) {
  const [myVote, setMyVote] = useState<number | null>(null);
  useEffect(() => {
    if (pub.phase === 'step') sfx('whoosh');
    if (pub.phase === 'vote') sfx('cheer');
  }, [pub.k, pub.phase]);
  const ids = pub.starters;
  if (pub.phase === 'step') {
    const submitted = priv?.submitted;
    const title = pub.k === 0 ? 'Write something silly to draw' : pub.kind === 'draw' ? 'Draw this!' : 'What is this drawing?';
    return (
      <div className="g-stage">
        <Banner title={title} sub={`Step ${pub.k + 1} of ${pub.steps}`} />
        <Countdown deadline={pub.deadline} total={pub.kind === 'draw' ? 45000 : 28000} />
        {pub.k > 0 && pub.kind === 'draw' && priv?.prevText && <div className="g-prompt">{priv.prevText}</div>}
        {pub.k > 0 && pub.kind === 'text' && priv?.prevKey && <div className="draw-stage"><StrokesView strokes={asStrokes(assets[priv.prevKey])} /></div>}
        {submitted ? (
          <Banner title="Passed along! ✉️" sub="Waiting for everyone..." />
        ) : pub.kind === 'draw' && priv?.cv ? (
          <>
            <DrawCanvas key={priv.cv} cv={priv.cv} me={me} editable={isPlayer} send={send} />
            <button className="btn btn-green" disabled={!isPlayer} onClick={() => send({ t: 'done' })}>Pass it on ➜</button>
          </>
        ) : (
          <TextEntry disabled={!isPlayer} onSubmit={(v) => send({ t: 'text', v })} placeholder={pub.k === 0 ? 'e.g. a hamster running for president' : 'Describe what you see...'} button="Pass it on" maxLength={80} />
        )}
        <DoneBar players={players} ids={ids} done={pub.submitted} label="Passed" />
      </div>
    );
  }
  const chains = (assets['relay:chains'] as Step[][] | undefined) ?? [];
  const counts: Record<number, number> = {};
  for (const c of Object.values(pub.reveal ?? {})) counts[c] = (counts[c] ?? 0) + 1;
  return (
    <div className="g-stage">
      <Banner title={pub.phase === 'vote' ? 'Vote for the best chain!' : 'And the funniest chain is...'} sub="Read each chain left to right" />
      <Countdown deadline={pub.phase === 'vote' ? pub.deadline : null} total={35000} />
      <div className="chains">
        {chains.map((chain, ci) => {
          const starter = player(ids[ci]);
          const mine = ci === priv?.myChain;
          return (
            <div key={ci} className={`chain ${myVote === ci ? 'on' : ''}`}>
              <div className="chain-head">
                {starter && <Avatar avatar={starter.avatar} size={26} />}
                <b>{starter?.name}'s chain</b>
                {pub.reveal && <span className="chip chip-yellow">{counts[ci] ?? 0} 🗳️</span>}
                {pub.phase === 'vote' && !mine && isPlayer && (
                  <button className={`btn btn-sm ${myVote === ci ? 'btn-green' : 'btn-white'}`} disabled={myVote != null} onClick={() => { setMyVote(ci); send({ t: 'vote', c: ci }); }}>
                    {myVote === ci ? 'Voted ✓' : 'Vote'}
                  </button>
                )}
              </div>
              <div className="chain-steps">
                {chain.map((st, si) => (
                  <div key={si} className="chain-step">
                    {st.kind === 'text' ? <div className="chain-text">“{st.text}”</div> : <StrokesView strokes={asStrokes(st.strokes)} />}
                    <span className="tiny muted">{player(st.by)?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </div>
  );
}
