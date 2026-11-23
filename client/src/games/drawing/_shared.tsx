// Shared helpers for drawing game views.
import type { RoomMember } from '@shared/types';
import { DOODLES } from '@shared/doodles';
import { StrokesView, type StrokeData } from '../../game/DrawCanvas';
import { Avatar } from '../../components/ui';
import { sfx } from '../../audio/sfx';

export function doodleStrokes(i: number | null | undefined, width = 10): StrokeData[] {
  if (i == null || !DOODLES[i]) return [];
  return DOODLES[i].strokes.map((p) => ({ c: 0, w: width, p }));
}

export function asStrokes(list: unknown): StrokeData[] {
  return Array.isArray(list) ? (list as StrokeData[]) : [];
}

/** Grid of drawings with optional voting. */
export function Gallery({ items, players, me, onVote, picked, badge, canVote, guide }: {
  items: { id: string; strokes: StrokeData[] }[];
  players: RoomMember[];
  me: string;
  onVote?: (id: string) => void;
  picked?: string | null;
  badge?: (id: string) => React.ReactNode;
  canVote?: (id: string) => boolean;
  guide?: StrokeData[] | null;
}) {
  return (
    <div className="gallery">
      {items.map((it) => {
        const p = players.find((x) => x.id === it.id);
        const can = !!onVote && (!canVote || canVote(it.id)) && it.id !== me;
        return (
          <button
            key={it.id}
            className={`gallery-item ${can ? 'can' : ''} ${picked === it.id ? 'on' : ''}`}
            disabled={!can}
            onClick={() => {
              if (!can) return;
              sfx('tap');
              onVote!(it.id);
            }}
          >
            <StrokesView strokes={it.strokes} guide={guide} />
            <span className="row-nw small" style={{ gap: 6 }}>
              {p && <Avatar avatar={p.avatar} size={22} />}
              <b>{it.id === me ? 'You' : p?.name ?? '???'}</b>
              {badge && badge(it.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
