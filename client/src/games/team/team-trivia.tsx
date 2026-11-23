import './team.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, Countdown, useKeys } from '../../game/kit';
import { teamColor, teamName } from '@shared/teams';
import { TeamBar, myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'buzz' | 'answer' | 'steal' | 'stealAnswer' | 'reveal';
  deadline: number;
  q: { q: string; options: string[]; topic: string } | null;
  buzzer: string | null;
  tried: number[];
  wrong: number[];
  picked: number | null;
  answer: number | null;
  result: { team: number | null; pid: string | null; right: boolean; steal: boolean } | null;
  teams: string[][];
  teamScores: number[];
}

export default function TeamTrivia({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const mine = myTeam(pub.teams, me);
  const canBuzz = isPlayer && (pub.phase === 'buzz' || pub.phase === 'steal') && !pub.tried.includes(mine);
  const answering = (pub.phase === 'answer' || pub.phase === 'stealAnswer') && pub.buzzer === me;
  const buzz = () => {
    if (!canBuzz) return;
    sfx('buzz');
    send({ t: 'buzz' });
  };
  useKeys((k) => {
    if (k === ' ') buzz();
  }, canBuzz);
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.result) sfx(pub.result.right && pub.result.team === mine ? 'correct' : pub.result.right ? 'lose' : 'wrong');
    if (pub.phase === 'steal') sfx('whoosh');
  }, [pub.phase, pub.i]);
  const buzzTeam = pub.buzzer ? pub.teams.findIndex((m) => m.includes(pub.buzzer!)) : -1;
  if (!pub.q) return <div className="g-stage" />;
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.teamScores} me={me} players={players} />
      <div className="g-prompt"><small>{pub.q.topic} · {pub.i + 1}/{pub.n}</small>{pub.q.q}</div>
      <Countdown deadline={pub.phase === 'reveal' ? null : pub.deadline} total={pub.phase === 'buzz' ? 12000 : 8000} />
      {(pub.phase === 'buzz' || pub.phase === 'steal') && (
        <>
          {pub.phase === 'steal' && <Banner title="Wrong! 🔓 Steal chance!" sub={pub.tried.includes(mine) ? 'The other team may steal…' : 'Buzz in to steal the points!'} tone="warn" />}
          <ChoiceGrid compact choices={pub.q.options.map((o, i) => ({ label: o, disabled: pub.wrong.includes(i) }))} picked={null} disabled onPick={() => undefined} keyboard={false} />
          {isPlayer && (
            <button className="buzz-btn" onPointerDown={(e) => { e.preventDefault(); buzz(); }} disabled={!canBuzz}>
              {pub.tried.includes(mine) ? '🔒' : 'BUZZ!'}
            </button>
          )}
        </>
      )}
      {(pub.phase === 'answer' || pub.phase === 'stealAnswer') && (
        <>
          <Banner
            title={answering ? 'You buzzed! Pick the answer' : `${nm(players, pub.buzzer)} answers for Team ${teamName(buzzTeam)}`}
            tone={answering ? 'warn' : 'default'}
          />
          <ChoiceGrid
            compact
            choices={pub.q.options.map((o, i) => ({ label: o, disabled: pub.wrong.includes(i), color: pub.wrong.includes(i) ? '#ffb3b8' : undefined }))}
            picked={null}
            disabled={!answering}
            onPick={(c) => send({ t: 'ans', c })}
          />
        </>
      )}
      {pub.phase === 'reveal' && (
        <>
          <ChoiceGrid compact choices={pub.q.options.map((o) => ({ label: o }))} picked={pub.picked} correct={pub.answer} wrong={pub.wrong} disabled onPick={() => undefined} keyboard={false} />
          {pub.result && (
            <Banner
              title={pub.result.right ? `${pub.result.steal ? '🦹 Stolen' : '✅ Correct'} — Team ${teamName(pub.result.team ?? 0)} scores!` : pub.result.pid ? 'Nobody got it!' : '⏰ Nobody buzzed in'}
              tone={pub.result.right ? (pub.result.team === mine ? 'good' : 'bad') : 'default'}
            />
          )}
        </>
      )}
      {buzzTeam >= 0 && pub.phase !== 'reveal' && <span className="team-tag" style={{ background: teamColor(buzzTeam) }}>🛎️ {nm(players, pub.buzzer)}</span>}
    </div>
  );
}
