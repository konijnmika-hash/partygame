import './social.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, Stage } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { Chat } from '../../screens/RoomScreen';
import { DoneBar, Phase, VotePlayers, nm } from './_kit';
import { sfx } from '../../audio/sfx';

type Role = 'thief' | 'detective' | 'guard';
interface Pub {
  day: number;
  phase: 'night' | 'day' | 'vote' | 'verdict' | 'over';
  deadline: number;
  alive: string[];
  lastVictim: string | null;
  lastOut: string | null;
  lastOutRole: Role | null;
  voted: string[];
  votes: Record<string, string> | null;
  winner: 'guards' | 'thieves' | null;
  roles: Record<string, Role> | null;
  log: string[];
  scores: Record<string, number> | null;
}
interface Priv {
  role: Role;
  partners: string[];
  investigated: Record<string, Role>;
  nightPick: string | null;
  myVote: string | null;
}

const ROLE_INFO: Record<Role, { e: string; name: string; goal: string }> = {
  thief: { e: '🦹', name: 'Thief', goal: 'Rob a Guard each night. Win when Thieves equal the honest players — or survive 3 days.' },
  detective: { e: '🕵️', name: 'Detective', goal: 'Each night, secretly learn one player\'s role. Lead the town to the Thieves!' },
  guard: { e: '💂', name: 'Guard', goal: 'Find the Thieves and vote them out by day.' },
};

export default function HiddenRole({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, Priv>) {
  const alive = pub.alive.includes(me);
  const role = priv?.role ?? 'guard';
  const info = ROLE_INFO[role];
  useEffect(() => {
    if (pub.phase === 'night') sfx('whoosh');
    if (pub.phase === 'day') sfx('ding');
    if (pub.phase === 'over') sfx(pub.winner === (role === 'thief' ? 'thieves' : 'guards') ? 'win' : 'lose');
  }, [pub.phase, pub.day]);
  const others = pub.alive.filter((id) => id !== me);
  return (
    <Stage className={pub.phase === 'night' ? 'night-stage' : ''}>
      <div className={`role-card role-${role}`}>
        <span className="rc-emoji">{info.e}</span>
        <div>
          <b>You are a {info.name}</b>
          <div className="tiny">{info.goal}</div>
          {priv?.partners.length ? <div className="tiny">Partner: {priv.partners.map((p) => nm(players, p)).join(', ')}</div> : null}
          {role === 'detective' && Object.keys(priv?.investigated ?? {}).length > 0 && (
            <div className="tiny">Findings: {Object.entries(priv!.investigated).map(([id, r]) => `${nm(players, id)} = ${ROLE_INFO[r].e}`).join(' · ')}</div>
          )}
        </div>
      </div>
      {!alive && pub.phase !== 'over' && <Banner title="You fainted 😵" sub="You can still watch — but no talking from beyond!" tone="bad" />}
      {pub.phase === 'night' && (
        <>
          <Phase title={`🌙 Night ${pub.day}`} sub={role === 'thief' ? 'Pick someone to rob' : role === 'detective' ? 'Pick someone to investigate' : 'Pick someone to keep an eye on'} deadline={pub.deadline} total={22000} />
          {alive && (
            <VotePlayers
              players={players}
              ids={others}
              exclude={role === 'thief' ? priv?.partners : []}
              picked={priv?.nightPick ?? null}
              disabled={!isPlayer || (role !== 'guard' && !!priv?.nightPick)}
              onPick={(id) => send({ t: 'night', target: id })}
            />
          )}
        </>
      )}
      {(pub.phase === 'day' || pub.phase === 'vote' || pub.phase === 'verdict') && (
        <>
          <Phase title={`☀️ Day ${pub.day}`} sub={pub.lastVictim ? `${nm(players, pub.lastVictim)} was robbed in the night and fainted!` : 'A quiet night...'} deadline={pub.phase !== 'verdict' ? pub.deadline : null} total={pub.phase === 'day' ? 40000 : 20000} />
          {pub.phase === 'day' && (
            <div className="discuss-wrap">
              <Chat className="game-chat" />
              <button className="btn btn-yellow" disabled={!isPlayer || !alive} onClick={() => send({ t: 'ready' })}>Ready to vote</button>
            </div>
          )}
          {pub.phase === 'vote' && alive && (
            <>
              <VotePlayers players={players} ids={others} picked={priv?.myVote} disabled={!isPlayer || !!priv?.myVote} onPick={(id) => send({ t: 'vote', target: id })} />
              <button className="btn btn-ghost" disabled={!isPlayer || !!priv?.myVote} onClick={() => send({ t: 'vote', target: 'skip' })}>Skip vote</button>
            </>
          )}
          {pub.phase === 'vote' && <DoneBar players={players} ids={pub.alive} done={pub.voted} label="Voted" />}
          {pub.phase === 'verdict' && (
            <Banner title={pub.lastOut ? `${nm(players, pub.lastOut)} was sent away!` : 'Nobody was sent away'} sub={pub.lastOut && pub.lastOutRole ? `They were a ${ROLE_INFO[pub.lastOutRole].name} ${ROLE_INFO[pub.lastOutRole].e}` : 'The thieves are still out there...'} tone={pub.lastOutRole === 'thief' ? 'good' : 'warn'} big />
          )}
        </>
      )}
      {pub.phase === 'over' && pub.roles && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <Banner title={pub.winner === 'guards' ? '💂 Guards win!' : '🦹 Thieves win!'} big tone={pub.winner === 'guards' ? 'good' : 'bad'} />
          <div className="role-reveal">
            {Object.entries(pub.roles).map(([id, r]) => (
              <div key={id} className={`rr-item ${pub.alive.includes(id) ? '' : 'out'}`}>
                {player(id) && <Avatar avatar={player(id)!.avatar} size={44} />}
                <span>{nm(players, id)}</span>
                <span className="chip">{ROLE_INFO[r].e} {ROLE_INFO[r].name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="hr-log">{pub.log.map((l, i) => <div key={i}>{l}</div>)}</div>
      {pub.scores && <MiniScores players={players} scores={pub.scores} me={me} limit={5} />}
    </Stage>
  );
}
