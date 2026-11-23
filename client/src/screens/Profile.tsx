import { useEffect, useMemo, useState } from 'react';
import type { Avatar as AvatarT } from '@shared/types';
import { COSMETICS, COSMETIC_MAP, unlockLabel, type CosmeticKind } from '@shared/cosmetics';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '@shared/achievements';
import { GAME_MAP, CATALOG } from '@shared/catalog/index';
import { validateUsername } from '@shared/validation';
import { api } from '../net/api';
import { set, toast, useStore } from '../state/store';
import { TopBar } from '../components/TopBar';
import { Avatar, LevelBadge, Spinner } from '../components/ui';
import { sfx } from '../audio/sfx';

type Tab = 'look' | 'achievements' | 'stats' | 'history';
const KINDS: { k: CosmeticKind; label: string }[] = [
  { k: 'color', label: '🎨 Colour' },
  { k: 'eyes', label: '👀 Eyes' },
  { k: 'mouth', label: '👄 Mouth' },
  { k: 'hat', label: '🎩 Hat' },
  { k: 'acc', label: '🎀 Extras' },
  { k: 'title', label: '🏷️ Title' },
];

function handleProgress(p: any) {
  if (!p) return;
  for (const a of p.achievements || []) {
    const d = ACHIEVEMENT_MAP[a];
    if (d) toast(`Achievement unlocked: ${d.name}`, 'achievement', { emoji: d.emoji });
  }
  if (p.achievements?.length) sfx('achievement');
}

export default function Profile() {
  const profile = useStore((s) => s.profile!);
  const [tab, setTab] = useState<Tab>('look');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const xpPct = profile.xpForNext ? Math.round((profile.xpIntoLevel / profile.xpForNext) * 100) : 100;

  const saveName = async () => {
    const v = validateUsername(name);
    if (!v.ok) return toast(v.error, 'error');
    const r = await api('/me', { method: 'PATCH', body: { username: v.value } });
    if (!r.ok) return toast(r.error || 'Could not rename', 'error');
    set({ profile: r.data });
    setEditingName(false);
    sfx('correct');
    toast('Name updated!', 'success');
  };

  return (
    <div className="page profile">
      <TopBar title="🏅 Profile" />
      <section className="profile-head glass">
        <Avatar avatar={profile.avatar} size={110} bob />
        <div className="stack-s grow">
          {editingName ? (
            <form className="row-nw" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoFocus aria-label="Username" />
              <button className="btn btn-green btn-sm" type="submit">Save</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditingName(false); setName(profile.name); }}>Cancel</button>
            </form>
          ) : (
            <div className="row-nw">
              <h1 className="ph-name">{profile.name}</h1>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingName(true)} aria-label="Edit username">✏️</button>
            </div>
          )}
          <div className="row-nw"><LevelBadge level={profile.level} /> <span className="chip">{profile.title}</span> {!profile.registered && <span className="chip chip-yellow">Guest</span>}</div>
          <div className="bar xp"><span style={{ width: `${xpPct}%` }} /></div>
          <div className="tiny muted">{profile.xp.toLocaleString()} XP total · {profile.xpIntoLevel}/{profile.xpForNext} to level {profile.level + 1}</div>
        </div>
      </section>
      <div className="tabs" role="tablist">
        {(['look', 'achievements', 'stats', 'history'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => { sfx('select'); setTab(t); }}>
            {t === 'look' ? '✨ Customise' : t === 'achievements' ? `🏆 Achievements ${profile.achievements.length}/${ACHIEVEMENTS.length}` : t === 'stats' ? '📊 Stats' : '🕘 History'}
          </button>
        ))}
      </div>
      {tab === 'look' && <Customise />}
      {tab === 'achievements' && <Achievements />}
      {tab === 'stats' && <Stats />}
      {tab === 'history' && <History />}
    </div>
  );
}

function Customise() {
  const profile = useStore((s) => s.profile!);
  const [draft, setDraft] = useState<AvatarT>(profile.avatar);
  const [titleId, setTitleId] = useState(profile.titleId);
  const [kind, setKind] = useState<CosmeticKind>('color');
  const [saving, setSaving] = useState(false);
  const unlocked = useMemo(() => new Set(profile.unlocked), [profile.unlocked]);
  const items = COSMETICS.filter((c) => c.kind === kind);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile.avatar) || titleId !== profile.titleId;

  const pick = (id: string) => {
    if (!unlocked.has(id)) {
      const c = COSMETIC_MAP[id];
      sfx('buzz');
      return toast(`🔒 ${c.name}: ${unlockLabel(c.unlock, (a) => ACHIEVEMENT_MAP[a]?.name ?? a)}`, 'info');
    }
    sfx('pop');
    if (kind === 'title') setTitleId(id);
    else setDraft((d) => ({ ...d, [kind]: id }));
  };
  const randomize = () => {
    const pickU = (k: CosmeticKind) => {
      const opts = COSMETICS.filter((c) => c.kind === k && unlocked.has(c.id));
      return opts[Math.floor(Math.random() * opts.length)]?.id;
    };
    setDraft({ color: pickU('color') ?? draft.color, eyes: pickU('eyes') ?? draft.eyes, mouth: pickU('mouth') ?? draft.mouth, hat: pickU('hat') ?? draft.hat, acc: pickU('acc') ?? draft.acc });
    sfx('swap');
  };
  const save = async () => {
    setSaving(true);
    const r = await api('/me', { method: 'PATCH', body: { avatar: draft, titleId } });
    setSaving(false);
    if (!r.ok) return toast(r.error || 'Could not save', 'error');
    set({ profile: r.data });
    handleProgress(r.progress);
    sfx('correct');
    toast('Looking good! 😎', 'success');
  };

  return (
    <div className="customise">
      <div className="cust-preview glass">
        <Avatar avatar={draft} size={150} bob />
        <div className="chip">{COSMETIC_MAP[titleId]?.name ?? 'Rookie'}</div>
        <div className="row-nw">
          <button className="btn btn-ghost btn-sm" onClick={randomize}>🎲 Random</button>
          <button className="btn btn-green" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving...' : 'Save look'}</button>
        </div>
      </div>
      <div className="cust-picker glass">
        <div className="tabs">
          {KINDS.map((k) => (
            <button key={k.k} className={`tab ${kind === k.k ? 'on' : ''}`} onClick={() => setKind(k.k)}>{k.label}</button>
          ))}
        </div>
        <div className={`cust-grid ${kind === 'title' ? 'titles' : ''}`}>
          {items.map((c) => {
            const isOn = kind === 'title' ? titleId === c.id : (draft as any)[kind] === c.id;
            const locked = !unlocked.has(c.id);
            return (
              <button key={c.id} className={`cust-item ${isOn ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => pick(c.id)} title={locked ? unlockLabel(c.unlock, (a) => ACHIEVEMENT_MAP[a]?.name ?? a) : c.name}>
                {kind === 'title' ? (
                  <span className="cust-title">{c.name}</span>
                ) : kind === 'color' ? (
                  <span className="cust-swatch" style={{ background: c.gradient ? `linear-gradient(135deg, ${c.gradient.join(',')})` : c.value }} />
                ) : (
                  <Avatar avatar={{ ...draft, [kind]: c.id }} size={54} />
                )}
                <span className="cust-name">{c.name}</span>
                {locked && <span className="cust-lock">🔒<small>{c.unlock.type === 'level' ? `Lv ${c.unlock.level}` : '★'}</small></span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Achievements() {
  const profile = useStore((s) => s.profile!);
  const got = new Map(profile.achievements.map((a) => [a.id, a.at]));
  return (
    <div className="ach-grid">
      {ACHIEVEMENTS.map((a) => {
        const at = got.get(a.id);
        return (
          <div key={a.id} className={`ach card ${at ? 'got' : 'locked'}`}>
            <div className="ach-emoji">{at ? a.emoji : '🔒'}</div>
            <div className="ach-name">{a.name}</div>
            <div className="tiny muted">{a.description}</div>
            <div className="tiny">{at ? `Unlocked ${new Date(at).toLocaleDateString()}` : `+${a.xp} XP`}</div>
          </div>
        );
      })}
    </div>
  );
}

function Stats() {
  const profile = useStore((s) => s.profile!);
  const [games, setGames] = useState<any[] | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => {
    api('/stats/games').then((r) => {
      if (r.ok) {
        setGames(r.data.games);
        setRecords(r.data.records);
      } else setGames([]);
    });
  }, []);
  const st = profile.stats;
  const tiles = [
    ['🎮', 'Rounds played', st.roundsPlayed],
    ['🥇', 'Rounds won', st.roundsWon],
    ['🎉', 'Parties played', st.sessionsPlayed],
    ['🏆', 'Parties won', st.sessionsWon],
    ['💰', 'Total points', st.totalPoints.toLocaleString()],
    ['🚀', 'Best round', st.bestRound],
    ['💎', 'Perfect rounds', st.perfectRounds],
    ['🔥', 'Best win streak', st.bestRoundStreak],
    ['🧭', 'Games discovered', `${st.distinctGames}/${CATALOG.length}`],
    ['🎤', 'Parties hosted', st.gamesHosted],
  ];
  return (
    <div className="stack">
      <div className="stat-tiles">
        {tiles.map(([e, l, v]) => (
          <div key={l as string} className="stat-tile glass">
            <div className="st-emoji">{e}</div>
            <div className="st-val">{v}</div>
            <div className="tiny muted">{l}</div>
          </div>
        ))}
      </div>
      {records.length > 0 && (
        <div className="glass">
          <div className="panel-title">📈 Personal records</div>
          <div className="stack-s">
            {records.map((r) => (
              <div key={r.game_id + r.key} className="row-nw small">
                <span>{GAME_MAP[r.game_id]?.emoji}</span>
                <span className="grow">{GAME_MAP[r.game_id]?.name} — {r.label}</span>
                <b>{r.format === 'ms' ? `${Math.round(r.value)} ms` : r.format === 'sec' ? `${(r.value / 1000).toFixed(2)} s` : r.format === 'pct' ? `${Math.round(r.value * 100)}%` : Math.round(r.value * 100) / 100}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="glass">
        <div className="panel-title">🎲 Per-game stats</div>
        {!games && <Spinner />}
        {games && games.length === 0 && <div className="empty">Play some games to see your stats here.</div>}
        {games && games.length > 0 && (
          <div className="game-stats">
            {[...games].sort((a, b) => b.plays - a.plays).map((g) => (
              <div key={g.game_id} className="gs-row">
                <span>{GAME_MAP[g.game_id]?.emoji}</span>
                <span className="grow">{GAME_MAP[g.game_id]?.name ?? g.game_id}</span>
                <span className="chip">{g.plays}× played</span>
                <span className="chip">{g.wins} wins</span>
                <span className="chip chip-yellow">best {g.best_points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function History() {
  const me = useStore((s) => s.profile!.id);
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api('/history').then((r) => setRows(r.ok ? r.data : []));
  }, []);
  if (!rows) return <div className="centered" style={{ padding: 30 }}><Spinner /></div>;
  if (!rows.length) return <div className="glass empty">No parties yet. Your match history will appear here.</div>;
  return (
    <div className="stack-s">
      {rows.map((h) => {
        const mine = h.players.find((p: any) => p.id === me);
        return (
          <div key={h.id} className="hist-row glass">
            <span className={`hist-rank r${Math.min(mine?.rank ?? 9, 4)}`}>#{mine?.rank ?? '?'}</span>
            <div className="grow">
              <div><b>{h.rounds} rounds</b> · {h.players.length} players · {mine?.points?.toLocaleString() ?? 0} pts</div>
              <div className="tiny muted">{new Date(h.endedAt).toLocaleString()} · {h.games.slice(0, 5).map((g: any) => GAME_MAP[g.gameId]?.emoji).join(' ')}</div>
            </div>
            <span className="chip">{h.isPublic ? 'Public' : `Room ${h.roomCode}`}</span>
          </div>
        );
      })}
    </div>
  );
}
