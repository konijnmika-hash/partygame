import './team.css';
import '../drawing/drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DrawCanvas, StrokesView } from '../../game/DrawCanvas';
import { Banner, Countdown } from '../../game/kit';
import { teamColor, teamName } from '@shared/teams';
import { asStrokes } from '../drawing/_shared';
import { TeamBar, myTeam } from './_team';
import { sfx } from '../../audio/sfx';

interface Pub {
  r: number;
  n: number;
  phase: 'draw' | 'rate' | 'result';
  deadline: number;
  prompt: string;
  teams: string[][];
  rated: string[];
  teamScores: number[];
  lastAvg: number[] | null;
}

export default function TeamDrawing({ pub, priv, me, isPlayer, send, players, assets }: GameViewProps<Pub, { myRatings: Record<number, number>; cv: string }>) {
  const mine = myTeam(pub.teams, me);
  const [local, setLocal] = useState<Record<number, number>>({});
  useEffect(() => {
    setLocal({});
    if (pub.phase === 'draw') sfx('go');
    if (pub.phase === 'rate') sfx('whoosh');
  }, [pub.phase, pub.r]);
  const gallery = assets[`td:gallery:${pub.r}`] as Record<number, unknown> | undefined;
  const ratings = { ...(priv?.myRatings ?? {}), ...local };
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.teamScores} me={me} players={players} fmt={(v) => `${(v / 20).toFixed(1)}★`} />
      <div className="g-prompt"><small>Round {pub.r + 1}/{pub.n} · draw together</small>{pub.prompt}</div>
      {pub.phase === 'draw' && priv && (
        <>
          <Countdown deadline={pub.deadline} total={55000} />
          <span className="team-tag" style={{ background: teamColor(mine) }}>Team {teamName(mine)} canvas — everyone can draw!</span>
          <DrawCanvas key={priv.cv} cv={priv.cv} me={me} editable={isPlayer} send={send} />
        </>
      )}
      {(pub.phase === 'rate' || pub.phase === 'result') && gallery && (
        <>
          <Banner title={pub.phase === 'rate' ? 'Rate the other teams!' : 'Ratings are in'} />
          <Countdown deadline={pub.phase === 'rate' ? pub.deadline : null} total={18000} />
          <div className="td-gallery">
            {pub.teams.map((_, t) => (
              <div key={t} className="rate-card" style={{ boxShadow: `inset 0 0 0 3px ${teamColor(t)}` }}>
                <div className="gallery-item"><StrokesView strokes={asStrokes(gallery[t])} /></div>
                <b>Team {teamName(t)}{t === mine ? ' (you)' : ''}</b>
                {pub.phase === 'rate' && t !== mine && isPlayer && (
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} className={`star ${ratings[t] >= n ? 'on' : ''}`} onClick={() => { setLocal({ ...local, [t]: n }); sfx('tap', 0.8 + n * 0.1); send({ t: 'rate', team: t, stars: n }); }} aria-label={`${n} stars`}>⭐</button>
                    ))}
                  </div>
                )}
                {pub.phase === 'result' && pub.lastAvg && <span className="chip chip-yellow">{pub.lastAvg[t].toFixed(1)} ★</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
