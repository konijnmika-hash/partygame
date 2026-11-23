import type { GameMeta } from '@shared/types';
import { CATEGORY_MAP } from '@shared/categories';
import { hashString } from '@shared/rng';

const PATTERNS = ['dots', 'stripes', 'waves', 'checks', 'rings', 'zigzag'];

/** Original procedural game card: category gradient + unique pattern per game + emoji glyph. */
export function GameTile({ meta, size = 'md', onClick, selected, disabled, badge }: {
  meta: GameMeta;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  badge?: string;
}) {
  const cat = CATEGORY_MAP[meta.category];
  const h = hashString(meta.id);
  const pattern = PATTERNS[h % PATTERNS.length];
  const tilt = ((h >> 4) % 13) - 6;
  return (
    <button
      type="button"
      className={`game-tile size-${size} pat-${pattern} ${selected ? 'selected' : ''}`}
      style={{ ['--g1' as any]: cat.gradient[0], ['--g2' as any]: cat.gradient[1], ['--tilt' as any]: `${tilt}deg` }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={meta.tagline}
    >
      <span className="gt-art" aria-hidden="true">
        <span className="gt-emoji">{meta.emoji}</span>
      </span>
      <span className="gt-name">{meta.name}</span>
      {size !== 'sm' && <span className="gt-meta">{meta.minPlayers}–{meta.maxPlayers} players · ~{Math.round(meta.duration / 10) * 10}s</span>}
      {meta.original && size !== 'sm' && <span className="gt-badge orig">NEW</span>}
      {badge && <span className="gt-badge">{badge}</span>}
      {selected && <span className="gt-check">✓</span>}
    </button>
  );
}
