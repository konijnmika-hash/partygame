// Shared UI pieces for party & social games.
import type { ReactNode } from 'react';
import type { RoomMember } from '@shared/types';
import { Avatar } from '../../components/ui';
import { Countdown } from '../../game/kit';
import { sfx } from '../../audio/sfx';

export function Phase({ title, sub, deadline, total }: { title: ReactNode; sub?: ReactNode; deadline?: number | null; total?: number }) {
  return (
    <div className="soc-phase">
      <div className="soc-title">{title}</div>
      {sub && <div className="soc-sub">{sub}</div>}
      {deadline ? <Countdown deadline={deadline} total={total ?? 20000} /> : null}
    </div>
  );
}

/** Grid of players to vote for. */
export function VotePlayers({ players, ids, onPick, picked, disabled, exclude, extra }: {
  players: RoomMember[];
  ids: string[];
  onPick: (id: string) => void;
  picked?: string | null;
  disabled?: boolean;
  exclude?: string[];
  extra?: (id: string) => ReactNode;
}) {
  return (
    <div className="vote-grid">
      {ids.map((id) => {
        const p = players.find((x) => x.id === id);
        if (!p) return null;
        const off = disabled || exclude?.includes(id);
        return (
          <button key={id} className={`vote-card ${picked === id ? 'on' : ''}`} disabled={off} onClick={() => { sfx('tap'); onPick(id); }}>
            <Avatar avatar={p.avatar} size={52} />
            <span className="vc-name">{p.name}</span>
            {extra && <span className="vc-extra">{extra(id)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Row of avatars showing who has already submitted. */
export function DoneBar({ players, ids, done, label = 'Done' }: { players: RoomMember[]; ids: string[]; done: string[]; label?: string }) {
  return (
    <div className="done-bar">
      <span className="tiny muted">{label}: {done.length}/{ids.length}</span>
      <div className="row-nw" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {ids.map((id) => {
          const p = players.find((x) => x.id === id);
          return p ? <span key={id} className={`db-av ${done.includes(id) ? 'done' : ''}`}><Avatar avatar={p.avatar} size={28} /></span> : null;
        })}
      </div>
    </div>
  );
}

export function Avatars({ players, ids, size = 22 }: { players: RoomMember[]; ids: string[]; size?: number }) {
  return (
    <span className="avs">
      {ids.map((id) => {
        const p = players.find((x) => x.id === id);
        return p ? <Avatar key={id} avatar={p.avatar} size={size} title={p.name} /> : null;
      })}
    </span>
  );
}

export function nm(players: RoomMember[], id: string | null | undefined): string {
  return players.find((p) => p.id === id)?.name ?? '???';
}
