// Shared bits for team minigames: which team am I on, team score bar, team tags.
import type { RoomMember } from '@shared/types';
import { teamColor, teamName } from '@shared/teams';
import { Avatar } from '../../components/ui';

export function myTeam(teams: string[][], me: string): number {
  return teams.findIndex((m) => m.includes(me));
}

export function TeamTag({ t, label }: { t: number; label?: string }) {
  return (
    <span className="team-tag" style={{ background: teamColor(t) }}>
      {label ?? `Team ${teamName(t)}`}
    </span>
  );
}

export function TeamBar({ teams, scores, me, fmt = (v) => String(Math.round(v)), players }: { teams: string[][]; scores: number[]; me: string; fmt?: (v: number) => string; players?: RoomMember[] }) {
  const mine = myTeam(teams, me);
  return (
    <div className="team-bar">
      {teams.map((members, t) => (
        <div key={t} className={`team-chip ${t === mine ? 'mine' : ''}`} style={{ background: teamColor(t) }}>
          <b>{teamName(t)}</b>
          {players && (
            <span className="team-faces">
              {members.slice(0, 4).map((id) => {
                const p = players.find((x) => x.id === id);
                return p ? <Avatar key={id} avatar={p.avatar} size={20} /> : null;
              })}
            </span>
          )}
          <span className="team-score">{fmt(scores[t] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
