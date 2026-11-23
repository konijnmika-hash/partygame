import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, RoundDots, Stage } from '../../game/kit';
import { Avatars, DoneBar, Phase } from './_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  q: string;
  phase: 'answer' | 'predict' | 'reveal';
  deadline: number;
  players: number;
  answered: string[];
  predicted: string[];
  reveal: { yes: number; preds: Record<string, number> } | null;
  scores: Record<string, number>;
}

export default function GroupPrediction({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { answer: boolean | null; pred: number | null }>) {
  const ids = Object.keys(pub.scores);
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.reveal && priv?.pred != null) sfx(priv.pred === pub.reveal.yes ? 'win' : Math.abs(priv.pred - pub.reveal.yes) <= 1 ? 'correct' : 'blip');
  }, [pub.phase, pub.i]);
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.i} />
      <div className="g-prompt">{pub.q}</div>
      {pub.phase === 'answer' && (
        <>
          <Phase title="Answer honestly (it's secret!)" deadline={pub.deadline} total={12000} />
          <div className="g-row">
            <button className={`btn btn-xl ${priv?.answer === true ? 'btn-green' : 'btn-white'}`} disabled={!isPlayer || priv?.answer != null} onClick={() => send({ t: 'answer', v: true })}>👍 YES</button>
            <button className={`btn btn-xl ${priv?.answer === false ? 'btn-red' : 'btn-white'}`} disabled={!isPlayer || priv?.answer != null} onClick={() => send({ t: 'answer', v: false })}>👎 NO</button>
          </div>
          <DoneBar players={players} ids={ids} done={pub.answered} label="Answered" />
        </>
      )}
      {pub.phase === 'predict' && (
        <>
          <Phase title="How many of you said YES?" deadline={pub.deadline} total={14000} />
          <div className="num-pick">
            {Array.from({ length: pub.players + 1 }, (_, k) => (
              <button key={k} className={`np-key ${priv?.pred === k ? 'ok' : ''}`} disabled={!isPlayer || priv?.pred != null} onClick={() => { sfx('tap'); send({ t: 'predict', v: k }); }}>{k}</button>
            ))}
          </div>
          <DoneBar players={players} ids={ids} done={pub.predicted} label="Predicted" />
        </>
      )}
      {pub.phase === 'reveal' && pub.reveal && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <Banner title={`${pub.reveal.yes} of ${pub.players} said YES`} sub={priv?.pred != null ? (priv.pred === pub.reveal.yes ? 'EXACT! 🔮 +150' : `You guessed ${priv.pred}`) : 'No prediction'} tone={priv?.pred === pub.reveal.yes ? 'good' : 'info'} big />
          <div className="pred-line">
            {Array.from({ length: pub.players + 1 }, (_, k) => (
              <div key={k} className={`pred-slot ${k === pub.reveal!.yes ? 'hit' : ''}`}>
                <span className="ps-n">{k}</span>
                <Avatars players={players} ids={Object.entries(pub.reveal!.preds).filter(([, v]) => v === k).map(([id]) => id)} size={20} />
              </div>
            ))}
          </div>
        </div>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
