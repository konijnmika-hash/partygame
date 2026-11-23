import './team.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown } from '../../game/kit';
import { TeamBar, myTeam } from './_team';
import { sfx } from '../../audio/sfx';

interface Pub {
  level: number;
  levels: number;
  phase: 'show' | 'build' | 'reveal';
  deadline: number;
  size: number;
  count: number;
  teams: string[][];
  done: boolean[];
  teamScores: number[];
  pattern: number[] | null;
  boards: number[][] | null;
  lastScores: number[] | null;
}

export default function TeamMemory({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { share: number[] | null; board: number[] }>) {
  const mine = myTeam(pub.teams, me);
  useEffect(() => {
    if (pub.phase === 'show') sfx('whoosh');
    if (pub.phase === 'build') sfx('go');
    if (pub.phase === 'reveal') sfx((pub.lastScores?.[mine] ?? 0) >= 60 ? 'correct' : 'wrong');
  }, [pub.phase, pub.level]);
  const cells = pub.size * pub.size;
  const share = new Set(priv?.share ?? []);
  const board = new Set(priv?.board ?? []);
  const pattern = new Set(pub.pattern ?? []);
  const myDone = mine >= 0 && pub.done[mine];
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.teamScores} me={me} players={players} />
      <div className="small">Level {pub.level + 1}/{pub.levels} · {pub.count} cells in the pattern</div>
      {pub.phase === 'show' && <Banner title="Memorise YOUR cells!" sub="Your teammates see the rest" />}
      {pub.phase === 'build' && <Banner title={myDone ? 'Locked in! ✓' : 'Rebuild the whole pattern together'} sub="Everyone on your team edits the same board" />}
      <Countdown deadline={pub.phase === 'reveal' ? null : pub.deadline} total={pub.phase === 'show' ? 3000 : 15000} />
      <div className="tgrid" style={{ gridTemplateColumns: `repeat(${pub.size}, 1fr)` }}>
        {Array.from({ length: cells }, (_, i) => {
          let cls = '';
          if (pub.phase === 'show') cls = share.has(i) ? 'on' : '';
          else if (pub.phase === 'build') cls = board.has(i) ? 'on' : '';
          else {
            const inBoard = pub.boards?.[mine]?.includes(i);
            cls = pattern.has(i) && inBoard ? 'hit' : inBoard ? 'miss' : pattern.has(i) ? 'ghost' : '';
          }
          return (
            <button
              key={i}
              className={`tcell ${cls}`}
              disabled={!isPlayer || pub.phase !== 'build' || myDone}
              onClick={() => {
                sfx('tap', board.has(i) ? 0.8 : 1.2);
                send({ t: 'tog', i });
              }}
            />
          );
        })}
      </div>
      {pub.phase === 'build' && isPlayer && !myDone && (
        <button className="btn btn-green" onClick={() => send({ t: 'done' })}>We're done ✓</button>
      )}
      {pub.phase === 'reveal' && pub.lastScores && <Banner title={`+${pub.lastScores[mine] ?? 0} for your team`} sub="Green = right · red = wrong · outlined = missed" />}
    </div>
  );
}
