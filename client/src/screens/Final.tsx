import { useEffect } from 'react';
import { GAME_MAP } from '@shared/catalog/index';
import { toast, useStore } from '../state/store';
import { emit, inviteLink, leaveRoom } from '../net/socket';
import { Avatar, CountUp, LevelBadge, Rank, useNow } from '../components/ui';
import { Confetti } from '../components/Confetti';
import { sfx } from '../audio/sfx';
import { teamColor, teamName } from './Lobby';

export function Final() {
  const final = useStore((s) => s.final);
  const room = useStore((s) => s.room!);
  const profile = useStore((s) => s.profile!);
  const me = profile.id;
  const isHost = room.hostId === me;
  const now = useNow(500);
  const left = room.phaseEndsAt ? Math.max(0, Math.ceil((room.phaseEndsAt - now) / 1000)) : null;
  const byId = (id: string) => room.members.find((m) => m.id === id);
  const mine = final?.standings.find((s) => s.id === me);

  useEffect(() => {
    if (!mine) return;
    sfx(mine.rank === 1 ? 'win' : 'cheer');
  }, [final?.sessionId]);

  if (!final) return <div className="page centered"><div className="spinner" /></div>;
  const top = final.standings.slice(0, 3);
  const invite = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Bloop Bash', text: `Join my Bloop Bash party! Code ${room.code}`, url: inviteLink(room.code) });
      else {
        await navigator.clipboard.writeText(inviteLink(room.code));
        toast('Invite link copied!', 'success');
      }
    } catch {
      /* cancelled */
    }
  };
  const xpPct = profile.xpForNext ? Math.round((profile.xpIntoLevel / profile.xpForNext) * 100) : 100;

  return (
    <div className="page final">
      <Confetti fire={final.sessionId} amount={220} />
      <header className="res-head anim-up">
        <span className="chip chip-dark">Party over!</span>
        <h1>🎉 {top[0] ? `${byId(top[0].id)?.name ?? 'Someone'} wins!` : 'GG!'}</h1>
      </header>

      {final.teams && final.teams.length > 0 && (
        <div className="team-res">
          {final.teams.map((t) => (
            <div key={t.team} className="team-res-item big" style={{ background: teamColor(t.team) }}>
              {t.rank === 1 ? '👑 ' : ''}{teamName(t.team)} team · {t.points.toLocaleString()}
            </div>
          ))}
        </div>
      )}

      <div className="podium big anim-pop">
        {[1, 0, 2].map((i) => {
          const p = top[i];
          if (!p) return <div key={i} className="pod-slot empty" />;
          const m = byId(p.id);
          return (
            <div key={p.id} className={`pod-slot place-${i + 1}`}>
              {i === 0 && <div className="pod-crown">👑</div>}
              {m && <Avatar avatar={m.avatar} size={i === 0 ? 110 : 80} bob mood={i === 0 ? 'happy' : undefined} />}
              <div className="pod-name">{m?.name ?? '???'}</div>
              <div className="pod-pts"><CountUp value={p.points} duration={1600} /></div>
              <div className="pod-block"><Rank rank={p.rank} /></div>
            </div>
          );
        })}
      </div>

      {final.awards.length > 0 && (
        <div className="awards">
          {final.awards.map((a, i) => {
            const m = byId(a.playerId);
            return (
              <div key={i} className="award card anim-pop" style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
                <div className="award-emoji">{a.emoji}</div>
                <div className="award-title">{a.title}</div>
                {m && <Avatar avatar={m.avatar} size={40} />}
                <div className="award-who">{m?.name ?? '???'}</div>
                <div className="tiny muted">{a.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="final-me glass">
        <div className="row-nw">
          <Avatar avatar={profile.avatar} size={52} />
          <div className="grow stack-s">
            <div className="row-nw"><LevelBadge level={profile.level} /> <b>{profile.name}</b> {mine && <span className="chip">#{mine.rank} · {mine.points.toLocaleString()} pts</span>}</div>
            <div className="bar xp"><span style={{ width: `${xpPct}%` }} /></div>
            <div className="tiny muted">{profile.xpIntoLevel}/{profile.xpForNext} XP to level {profile.level + 1}</div>
          </div>
        </div>
      </div>

      <div className="stand-list compact">
        {final.standings.map((s) => {
          const m = byId(s.id);
          return (
            <div key={s.id} className={`stand-row ${s.id === me ? 'me' : ''}`}>
              <Rank rank={s.rank} />
              {m && <Avatar avatar={m.avatar} size={34} />}
              <span className="res-name grow">{m?.name ?? 'Player left'}</span>
              {s.wins > 0 && <span className="chip">🏅 {s.wins}</span>}
              <span className="stand-pts">{s.points.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      <details className="glass rounds-recap">
        <summary>Rounds recap ({final.rounds.length})</summary>
        <div className="stack-s">
          {final.rounds.map((r, i) => (
            <div key={i} className="row-nw small">
              <span className="chip">{i + 1}</span> {GAME_MAP[r.gameId]?.emoji} {GAME_MAP[r.gameId]?.name}
              <span className="grow" />
              {r.winnerId && <span>🏆 {byId(r.winnerId)?.name ?? '—'}</span>}
            </div>
          ))}
        </div>
      </details>

      <div className="final-actions">
        {isHost ? (
          <>
            <button className="btn btn-green btn-lg" onClick={() => { sfx('go'); emit('room:again'); }}>🔁 Play again</button>
            <button className="btn btn-purple btn-lg" onClick={() => { sfx('click'); emit('room:lobby'); }}>🏠 Back to lobby</button>
          </>
        ) : room.isPublic ? (
          <span className="chip chip-dark">Next party in {left ?? 0}s</span>
        ) : (
          <span className="chip chip-dark">Waiting for the host...</span>
        )}
        <button className="btn btn-cyan btn-lg" onClick={invite}>📨 Invite friends</button>
        <button className="btn btn-ghost" onClick={() => leaveRoom()}>Leave</button>
      </div>
    </div>
  );
}
