import { useEffect, useMemo, useState } from 'react';
import type { CategoryId, GameMeta } from '@shared/types';
import { CATALOG } from '@shared/catalog/index';
import { CATEGORIES, CATEGORY_MAP } from '@shared/categories';
import { api } from '../net/api';
import { useStore } from '../state/store';
import { TopBar } from '../components/TopBar';
import { GameTile } from '../components/GameTile';
import { Modal } from '../components/ui';
import { sfx } from '../audio/sfx';

export default function Catalog() {
  const available = useStore((s) => s.available);
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [q, setQ] = useState('');
  const [players, setPlayers] = useState(0);
  const [sel, setSel] = useState<GameMeta | null>(null);
  const [stats, setStats] = useState<{ games: any[]; records: any[] } | null>(null);
  useEffect(() => {
    api('/stats/games').then((r) => r.ok && setStats(r.data));
  }, []);
  const played = new Map((stats?.games ?? []).map((g: any) => [g.game_id, g]));
  const list = useMemo(
    () => CATALOG.filter((g) => available.has(g.id))
      .filter((g) => cat === 'all' || g.category === cat)
      .filter((g) => !q || (g.name + g.tagline).toLowerCase().includes(q.toLowerCase()))
      .filter((g) => !players || (players >= g.minPlayers && players <= g.maxPlayers)),
    [available, cat, q, players],
  );
  const total = available.size;
  return (
    <div className="page">
      <TopBar title={`🎮 ${total} Games`} />
      <div className="glass stack" style={{ marginBottom: 14 }}>
        <div className="row-nw">
          <input className="input input-dark" placeholder="Search games..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search games" />
          <select className="input input-dark" style={{ maxWidth: 150 }} value={players} onChange={(e) => setPlayers(Number(e.target.value))} aria-label="Players">
            <option value={0}>Any players</option>
            {[2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </div>
        <div className="tabs">
          <button className={`tab ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`tab ${cat === c.id ? 'on' : ''}`} onClick={() => { sfx('select'); setCat(c.id); }}>{c.emoji} {c.name}</button>
          ))}
        </div>
        <div className="tiny muted">You have played {played.size} of {total} games.</div>
      </div>
      {cat !== 'all' && <p className="cat-blurb">{CATEGORY_MAP[cat].blurb}</p>}
      <div className="catalog-grid">
        {list.map((g) => (
          <GameTile key={g.id} meta={g} onClick={() => { sfx('click'); setSel(g); }} badge={played.has(g.id) ? `✓ ${played.get(g.id).plays}×` : undefined} />
        ))}
        {list.length === 0 && <div className="empty">No games match that filter.</div>}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.emoji} ${sel.name}` : ''}>
        {sel && (
          <div className="stack">
            <div className="row">
              <span className="chip" style={{ background: CATEGORY_MAP[sel.category].color, color: '#fff' }}>{CATEGORY_MAP[sel.category].emoji} {CATEGORY_MAP[sel.category].name}</span>
              <span className="chip">👥 {sel.minPlayers}–{sel.maxPlayers}</span>
              <span className="chip">⏱ ~{sel.duration}s</span>
              {sel.teams && <span className="chip">🤝 Teams</span>}
              {sel.original && <span className="chip chip-pink">Bloop original</span>}
            </div>
            <p><b>{sel.tagline}</b></p>
            <ol className="intro-steps light">{sel.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
            {played.has(sel.id) && (
              <div className="row">
                <span className="chip">Played {played.get(sel.id).plays}×</span>
                <span className="chip">{played.get(sel.id).wins} wins</span>
                <span className="chip chip-yellow">Best {played.get(sel.id).best_points}</span>
              </div>
            )}
            {(stats?.records ?? []).filter((r: any) => r.game_id === sel.id).map((r: any) => (
              <div key={r.key} className="small">📈 {r.label}: <b>{r.format === 'ms' ? `${Math.round(r.value)} ms` : r.value}</b></div>
            ))}
            <p className="tiny" style={{ color: 'var(--ink-soft)' }}>Host a room and pick this game from “Pick games” to play it with friends.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
