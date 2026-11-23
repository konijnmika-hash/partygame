// Shared view for Eyes Closed (blind tracing) and Drawing From Memory.
import './drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DrawCanvas, StrokesView } from '../../game/DrawCanvas';
import { Banner, Countdown, RoundDots, MiniScores } from '../../game/kit';
import { Gallery, asStrokes, doodleStrokes } from './_shared';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  phase: 'show' | 'draw' | 'reveal';
  deadline: number;
  doodle: number;
  cvPrefix: string;
  acc: Record<string, number[]>;
}

export function TraceView({ pub, me, isPlayer, send, players, assets, mode }: GameViewProps<Pub> & { mode: 'blind' | 'memory' }) {
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const target = doodleStrokes(pub.doodle);
  useEffect(() => {
    setStarted(false);
    setDone(false);
    if (pub.phase === 'show') sfx('whoosh');
    if (pub.phase === 'draw') sfx('go');
  }, [pub.phase, pub.round]);
  const gallery = assets[`${pub.cvPrefix}:gallery:${pub.round}`] as Record<string, { strokes: any[]; acc: number }> | undefined;
  const totals = Object.fromEntries(Object.entries(pub.acc).map(([id, a]) => [id, a.reduce((x, y) => x + y, 0)]));
  useEffect(() => {
    if (pub.phase === 'reveal' && gallery?.[me]) sfx(gallery[me].acc >= 70 ? 'win' : gallery[me].acc >= 45 ? 'correct' : 'blip');
  }, [pub.phase, !!gallery]);
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.round} />
      <Countdown deadline={pub.phase !== 'reveal' ? pub.deadline : null} total={pub.phase === 'show' ? 3500 : 14000} />
      {pub.phase === 'show' && (
        <>
          <Banner title="Memorize this shape! 👀" sub={mode === 'blind' ? 'Then trace it blindfolded' : 'Then redraw it from memory'} />
          <div className="draw-stage"><StrokesView strokes={target} /></div>
        </>
      )}
      {pub.phase === 'draw' && (
        <>
          <Banner title={mode === 'blind' ? (started ? '🫣 Keep tracing... no peeking!' : 'Trace the shape — it vanishes when you start!') : 'Draw it from memory!'} sub={mode === 'blind' ? 'Your ink is invisible' : 'Position and shape both count'} />
          <DrawCanvas
            key={`${pub.round}`}
            cv={`${pub.cvPrefix}:${me}:${pub.round}`}
            me={me}
            editable={isPlayer && !done}
            blind={mode === 'blind'}
            send={send}
            toolbar={mode === 'memory'}
            limitColors={[0, 2, 7, 5]}
            guide={mode === 'blind' && !started ? target : null}
            onStrokeStart={() => setStarted(true)}
          />
          {isPlayer && !done && <button className="btn btn-green" onClick={() => { setDone(true); send({ t: 'done' }); }}>I'm done ✓</button>}
          {done && <Banner title="Locked in!" sub="Waiting for the others..." />}
        </>
      )}
      {pub.phase === 'reveal' && gallery && (
        <>
          <Banner title={gallery[me] ? `${gallery[me].acc}% accurate!` : 'Results'} sub="Your drawing over the real shape" tone={gallery[me]?.acc >= 60 ? 'good' : 'info'} />
          <Gallery items={Object.entries(gallery).map(([id, g]) => ({ id, strokes: asStrokes(g.strokes) }))} players={players} me={me} guide={target} badge={(id) => <span className="chip chip-yellow">{gallery[id].acc}%</span>} />
        </>
      )}
      <MiniScores players={players} scores={totals} me={me} fmt={(v) => `${v}%`} title="Total accuracy" limit={6} />
    </div>
  );
}
