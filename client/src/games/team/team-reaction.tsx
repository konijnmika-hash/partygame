import './team.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { teamName } from '@shared/teams';
import { useKeys } from '../../game/kit';
import { TeamBar, myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'wait' | 'go' | 'show';
  kind: 'all' | 'player' | null;
  targets: string[];
  shownAt: number;
  tapped: string[];
  early: string[];
  teams: string[][];
  teamScores: number[];
  last: { team: number; pts: number; avg: number | null; sync: boolean }[] | null;
  taps: Record<string, number> | null;
}

export default function TeamReaction({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const mine = myTeam(pub.teams, me);
  const seenAt = useRef(0);
  useEffect(() => {
    if (pub.phase === 'go') {
      seenAt.current = performance.now();
      sfx('go');
    }
  }, [pub.phase, pub.i]);
  const myTarget = pub.kind === 'player' ? pub.targets[mine] : null;
  const shouldTap = pub.kind === 'all' || myTarget === me;
  const tapped = pub.tapped.includes(me);
  const early = pub.early.includes(me);
  const tap = () => {
    if (!isPlayer || tapped || early) return;
    vibrate(10);
    if (pub.phase === 'wait') {
      sfx('wrong');
      send({ t: 'tap' });
      return;
    }
    if (pub.phase !== 'go') return;
    sfx(shouldTap ? 'tap' : 'wrong');
    send({ t: 'tap', ms: Math.round(performance.now() - seenAt.current) });
  };
  useKeys((k) => {
    if (k === ' ' || k === 'Enter') tap();
  }, isPlayer);
  let cls = 'wait';
  let label: React.ReactNode = 'Wait for it…';
  if (pub.phase === 'go') {
    if (pub.kind === 'all') {
      cls = 'go';
      label = tapped ? 'Tapped ✓' : 'EVERYONE TAP!';
    } else {
      const tgt = myTarget ? player(myTarget) : null;
      cls = shouldTap ? 'go' : 'other';
      label = (
        <>
          {tgt && <Avatar avatar={tgt.avatar} size={84} bob />}
          {shouldTap ? (tapped ? 'Tapped ✓' : 'YOU! TAP!') : `Only ${tgt?.name ?? '…'} taps!`}
          {!shouldTap && <small>Hands off!</small>}
        </>
      );
    }
  } else if (pub.phase === 'show') {
    cls = 'other';
    const r = pub.last?.[mine];
    label = (
      <>
        {r ? `+${r.pts}` : ''}
        <small>{r?.avg != null ? `team avg ${r.avg} ms` : 'not everyone tapped'}{r?.sync ? ' · 🎯 in sync bonus!' : ''}</small>
      </>
    );
  }
  if (early && pub.phase !== 'show') label = <>Too early! 😬<small>Wait for the signal next time</small></>;
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.teamScores} me={me} players={players} />
      <div className="small">Signal {Math.max(1, pub.i + 1)}/{pub.n} · you are on Team {teamName(Math.max(0, mine))}</div>
      <div className={`tr-zone ${cls}`} onPointerDown={(e) => { e.preventDefault(); tap(); }}>
        {label}
      </div>
      {pub.phase === 'show' && pub.last && (
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          {pub.last.map((r) => (
            <span key={r.team} className="chip chip-dark">Team {teamName(r.team)}: +{r.pts}{r.sync ? ' 🎯' : ''}</span>
          ))}
        </div>
      )}
      {pub.phase === 'go' && pub.kind === 'player' && <div className="small">Target for each team: {pub.targets.map((id) => nm(players, id)).join(' · ')}</div>}
    </div>
  );
}
