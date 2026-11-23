import './drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DrawCanvas, StrokesView } from '../../game/DrawCanvas';
import { Banner, Countdown, MiniScores, RoundDots, SecondsLeft } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { asStrokes } from './_shared';
import { nm } from '../social/_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  prompt: string;
  groups: string[][];
  phase: 'ready' | 'draw' | 'vote' | 'result';
  deadline: number;
  voted: string[];
  tally: Record<string, number> | null;
  scores: Record<string, number>;
}

export default function Draw10({ pub, priv, me, isPlayer, send, players, player, assets }: GameViewProps<Pub, { myVotes: Record<number, string>; cv: string }>) {
  const [local, setLocal] = useState<Record<number, string>>({});
  useEffect(() => {
    setLocal({});
    if (pub.phase === 'draw') sfx('go');
    if (pub.phase === 'vote') sfx('whoosh');
  }, [pub.phase, pub.round]);
  const myGroup = pub.groups.find((g) => g.includes(me)) ?? [];
  const rivals = myGroup.filter((id) => id !== me);
  const gallery = assets[`d10:gallery:${pub.round}`] as Record<string, any[]> | undefined;
  const votes = { ...(priv?.myVotes ?? {}), ...local };
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.round} />
      <div className="g-prompt"><small>Draw in 10 seconds</small>{pub.prompt}</div>
      {pub.phase === 'ready' && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <Banner title="⚔️ Duel!" sub={rivals.length ? `You vs ${rivals.map((r) => nm(players, r)).join(' & ')}` : 'Get ready!'} big />
          <div className="row">{myGroup.map((id) => player(id) && <Avatar key={id} avatar={player(id)!.avatar} size={64} bob />)}</div>
          <SecondsLeft deadline={pub.deadline} />
        </div>
      )}
      {pub.phase === 'draw' && priv && (
        <>
          <div className="d10-timer"><SecondsLeft deadline={pub.deadline} /></div>
          <DrawCanvas key={priv.cv} cv={priv.cv} me={me} editable={isPlayer} send={send} />
        </>
      )}
      {(pub.phase === 'vote' || pub.phase === 'result') && gallery && (
        <>
          <Banner title={pub.phase === 'vote' ? 'Pick the winner of each duel!' : 'Duel results'} />
          <Countdown deadline={pub.phase === 'vote' ? pub.deadline : null} total={20000} />
          <div className="duels">
            {pub.groups.map((grp, gi) => (
              <div key={gi} className="duel">
                {grp.map((id) => {
                  const can = pub.phase === 'vote' && isPlayer && id !== me && !votes[gi];
                  const n = pub.tally?.[id] ?? 0;
                  const max = pub.tally ? Math.max(...grp.map((m) => pub.tally![m] ?? 0)) : 0;
                  return (
                    <button key={id} className={`gallery-item ${can ? 'can' : ''} ${votes[gi] === id ? 'on' : ''} ${pub.tally && n === max && n > 0 ? 'winner' : ''}`} disabled={!can} onClick={() => { setLocal({ ...local, [gi]: id }); sfx('tap'); send({ t: 'vote', g: gi, target: id }); }}>
                      <StrokesView strokes={asStrokes(gallery[id])} />
                      <span className="small"><b>{id === me ? 'You' : nm(players, id)}</b> {pub.tally && <span className="chip chip-yellow">{n} 🗳️</span>}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </div>
  );
}
