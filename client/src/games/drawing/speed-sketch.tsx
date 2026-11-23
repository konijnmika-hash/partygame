import './drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DrawCanvas } from '../../game/DrawCanvas';
import { Banner, Countdown, MiniScores, RoundDots } from '../../game/kit';
import { Gallery, asStrokes } from './_shared';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  prompt: string;
  phase: 'draw' | 'vote' | 'reveal';
  deadline: number;
  finished: string[];
  voted: string[];
  reveal: Record<string, string> | null;
  scores: Record<string, number>;
}

export default function SpeedSketch({ pub, priv, me, isPlayer, send, players, assets }: GameViewProps<Pub, { myVote: string | null; cv: string }>) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    if (pub.phase === 'draw') sfx('go');
    if (pub.phase === 'vote') sfx('whoosh');
  }, [pub.phase, pub.round]);
  const gallery = assets[`ss:gallery:${pub.round}`] as Record<string, any[]> | undefined;
  const counts: Record<string, number> = {};
  for (const t of Object.values(pub.reveal ?? {})) counts[t] = (counts[t] ?? 0) + 1;
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.round} />
      <div className="g-prompt"><small>Draw this!</small>{pub.prompt}</div>
      <Countdown deadline={pub.phase !== 'reveal' ? pub.deadline : null} total={pub.phase === 'draw' ? 32000 : 22000} />
      {pub.phase === 'draw' && priv && (
        <>
          <DrawCanvas key={priv.cv} cv={priv.cv} me={me} editable={isPlayer && !done} send={send} />
          {isPlayer && (done ? <Banner title="Masterpiece submitted 🖼️" sub={`${pub.finished.length} finished`} /> : <button className="btn btn-green" onClick={() => { setDone(true); send({ t: 'done' }); }}>Finished!</button>)}
        </>
      )}
      {pub.phase !== 'draw' && gallery && (
        <>
          <Banner title={pub.phase === 'vote' ? (priv?.myVote ? 'Vote cast! 🗳️' : 'Vote for your favourite!') : 'The people have spoken!'} />
          <Gallery
            items={Object.entries(gallery).map(([id, st]) => ({ id, strokes: asStrokes(st) }))}
            players={players}
            me={me}
            picked={priv?.myVote}
            onVote={pub.phase === 'vote' && isPlayer && !priv?.myVote ? (id) => send({ t: 'vote', target: id }) : undefined}
            badge={(id) => (pub.reveal ? <span className="chip chip-yellow">{counts[id] ?? 0} 🗳️</span> : null)}
          />
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </div>
  );
}
