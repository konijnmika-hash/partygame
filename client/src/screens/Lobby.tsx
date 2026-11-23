import { useMemo, useState } from 'react';
import type { CategoryId, RoomMember, RoomSettings } from '@shared/types';
import { CATALOG, GAME_MAP, supportsCount } from '@shared/catalog/index';
import { CATEGORIES, CATEGORY_MAP } from '@shared/categories';
import { toast, useStore } from '../state/store';
import { emit, emitAck, inviteLink, leaveRoom } from '../net/socket';
import { Avatar, LevelBadge, Modal, Seg, Toggle, useNow } from '../components/ui';
import { QRCode } from '../components/QRCode';
import { GameTile } from '../components/GameTile';
import { SoundToggles } from '../components/TopBar';
import { Chat, EmoteBar } from './RoomScreen';
import { sfx } from '../audio/sfx';

const TEAM_COLORS = ['#FF4F5F', '#3DA9FC', '#34CF78'];
const TEAM_NAMES = ['Red', 'Blue', 'Green'];

export function teamColor(t: number | null): string | undefined {
  return t == null ? undefined : TEAM_COLORS[t % TEAM_COLORS.length];
}
export function teamName(t: number): string {
  return TEAM_NAMES[t % TEAM_NAMES.length];
}

async function patch(p: Partial<RoomSettings>) {
  const r = await emitAck('room:settings', p);
  if (!r.ok) toast(r.error || 'Could not change settings', 'error');
}

export function Lobby() {
  const room = useStore((s) => s.room!);
  const me = useStore((s) => s.profile!.id);
  const available = useStore((s) => s.available);
  const [showQr, setShowQr] = useState(false);
  const [picker, setPicker] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const unread = useStore((s) => s.unreadChat);
  const isHost = room.hostId === me;
  const meMember = room.members.find((m) => m.id === me);
  const link = inviteLink(room.code);
  const nPlayers = room.members.filter((m) => m.connected || m.isBot).length;
  const now = useNow(250);
  const autoIn = room.autoStartAt ? Math.max(0, Math.ceil((room.autoStartAt - now) / 1000)) : null;
  const compatible = useMemo(
    () => CATALOG.filter((g) => available.has(g.id) && supportsCount(g, Math.max(2, nPlayers))).length,
    [available, nPlayers],
  );

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied!`, 'success', { emoji: '📋' });
      sfx('pop');
    } catch {
      toast(text, 'info');
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Bloop Bash party!', text: `Join my party with code ${room.code}`, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy(link, 'Invite link');
  };

  const start = async () => {
    sfx('click');
    const r = await emitAck('room:start');
    if (!r.ok) {
      sfx('wrong');
      toast(r.error || 'Could not start', 'error');
    }
  };

  return (
    <div className="page lobby">
      <header className="lobby-head">
        <button className="btn btn-ghost btn-sm" onClick={() => { sfx('click'); leaveRoom(); }}>← Leave</button>
        <div className="room-code-wrap">
          <span className="tiny muted">{room.isPublic ? 'PUBLIC PARTY' : 'ROOM CODE'}</span>
          <button className="room-code" onClick={() => copy(room.code, 'Room code')} aria-label={`Room code ${room.code}, tap to copy`}>
            {room.code.split('').map((c, i) => <span key={i} style={{ animationDelay: `${i * 0.08}s` }}>{c}</span>)}
          </button>
        </div>
        <SoundToggles />
      </header>

      <div className="invite-row">
        <button className="btn btn-cyan btn-sm" onClick={share}>📨 Invite friends</button>
        <button className="btn btn-ghost btn-sm" onClick={() => copy(link, 'Invite link')}>🔗 Copy link</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowQr(true)}>📱 QR code</button>
      </div>

      <div className="lobby-grid">
        <section className="glass players-panel">
          <div className="panel-title">
            👥 Players <span className="chip">{room.members.length}/{room.settings.maxPlayers}</span>
          </div>
          <div className="member-grid">
            {room.members.map((m, i) => (
              <MemberCard key={m.id} m={m} me={me} isHost={isHost} index={i} teams={room.settings.teamMode !== 'off'} />
            ))}
            {!room.isPublic && room.members.length < room.settings.maxPlayers && (
              <button className="member-card add" onClick={() => (isHost ? emit('room:bot', 'add') : share())}>
                <span className="mc-plus">+</span>
                <span className="small">{isHost ? 'Add a bot' : 'Invite'}</span>
              </button>
            )}
          </div>
          {isHost && room.members.some((m) => m.isBot) && (
            <button className="btn btn-ghost btn-sm" onClick={() => emit('room:bot', 'remove')}>Remove a bot</button>
          )}
          {room.settings.teamMode !== 'off' && meMember && (
            <div className="row">
              <span className="small">Your team:</span>
              {Array.from({ length: room.settings.teamMode === 'teams3' ? 3 : 2 }, (_, t) => (
                <button key={t} className={`team-btn ${meMember.team === t ? 'on' : ''}`} style={{ background: TEAM_COLORS[t] }} onClick={() => emit('room:team', t)}>
                  {TEAM_NAMES[t]}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="glass settings-panel">
          <div className="panel-title">🎛️ Party settings {!isHost && <span className="chip">{room.isPublic ? 'auto' : 'host only'}</span>}</div>
          <SettingsForm settings={room.settings} editable={isHost} onPickGames={() => setPicker(true)} compatible={compatible} />
        </section>

        <section className="glass chat-panel desktop-only">
          <div className="panel-title">💬 Chat</div>
          <Chat />
        </section>
      </div>

      <div className="lobby-bar">
        <EmoteBar />
        <button className="btn btn-ghost btn-sm mobile-only" onClick={() => setChatOpen(true)}>💬 {unread > 0 ? <span className="chip chip-pink">{unread}</span> : 'Chat'}</button>
        <div className="grow" />
        {room.isPublic ? (
          <>
            {autoIn != null ? <span className="chip chip-yellow">Starting in {autoIn}s</span> : <span className="small muted">Waiting for players...</span>}
            {room.members.filter((m) => !m.isBot && m.connected).length === 1 && (
              <button className="btn btn-purple" onClick={() => emit('room:soloBots')}>🤖 Play now with bots</button>
            )}
            <ReadyButton ready={!!meMember?.ready} />
          </>
        ) : isHost ? (
          <button className="btn btn-green btn-lg start-btn" onClick={start} disabled={nPlayers < 2}>
            {nPlayers < 2 ? 'Need 2+ players' : `▶ Start party (${room.settings.rounds} rounds)`}
          </button>
        ) : (
          <>
            <span className="small muted">Waiting for the host to start...</span>
            <ReadyButton ready={!!meMember?.ready} />
          </>
        )}
      </div>

      <Modal open={showQr} onClose={() => setShowQr(false)} title="Scan to join">
        <div className="stack center" style={{ alignItems: 'center' }}>
          <QRCode text={link} size={240} />
          <div className="room-code small-code">{room.code}</div>
          <p className="muted small">Open the camera on your phone and scan. Or go to <b>{window.location.host}</b> and enter the code.</p>
        </div>
      </Modal>
      <Modal open={chatOpen} onClose={() => setChatOpen(false)} title="Chat">
        <div className="chat-modal"><Chat /></div>
      </Modal>
      {picker && <GamePicker settings={room.settings} onClose={() => setPicker(false)} players={nPlayers} />}
    </div>
  );
}

function ReadyButton({ ready }: { ready: boolean }) {
  return (
    <button className={`btn ${ready ? 'btn-green' : 'btn-yellow'} btn-lg`} onClick={() => { sfx(ready ? 'swap' : 'correct'); emit('room:ready', !ready); }}>
      {ready ? '✓ Ready!' : 'Ready?'}
    </button>
  );
}

function MemberCard({ m, me, isHost, index, teams }: { m: RoomMember; me: string; isHost: boolean; index: number; teams: boolean }) {
  const statusLabel = m.isBot ? 'Bot' : m.status === 'ready' ? 'Ready' : m.status === 'disconnected' ? 'Offline' : m.status === 'spectating' ? 'Watching' : m.status === 'playing' ? 'Playing' : 'Waiting';
  return (
    <div className={`member-card ${m.id === me ? 'me' : ''} ${!m.connected && !m.isBot ? 'offline' : ''}`} style={{ animationDelay: `${index * 0.05}s`, borderColor: teams ? teamColor(m.team) : undefined }}>
      {m.isHost && <span className="mc-crown" title="Host">👑</span>}
      {isHost && m.id !== me && (
        <button className="mc-kick" onClick={() => emit('room:kick', m.id)} aria-label={`Remove ${m.name}`} title="Remove">✕</button>
      )}
      <Avatar avatar={m.avatar} size={64} bob={m.status === 'ready' || m.isBot} />
      <div className="mc-name">{m.name}{m.id === me && <span className="tiny"> (you)</span>}</div>
      <div className="row-nw" style={{ justifyContent: 'center', gap: 6 }}>
        <LevelBadge level={m.level} />
        <span className={`chip status-${m.isBot ? 'bot' : m.status}`}>{statusLabel}</span>
      </div>
      {m.roomScore > 0 && <div className="tiny muted">{m.roomScore.toLocaleString()} pts here</div>}
    </div>
  );
}

function SettingsForm({ settings, editable, onPickGames, compatible }: { settings: RoomSettings; editable: boolean; onPickGames: () => void; compatible: number }) {
  const s = settings;
  const dis = !editable;
  return (
    <div className="settings-form">
      <div className="sf-row">
        <label>Rounds</label>
        <div className="row-nw">
          <button className="btn btn-ghost btn-icon btn-sm" disabled={dis || s.rounds <= 1} onClick={() => patch({ rounds: s.rounds - 1 })} aria-label="Fewer rounds">−</button>
          <span className="sf-num">{s.rounds}</span>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={dis || s.rounds >= 20} onClick={() => patch({ rounds: s.rounds + 1 })} aria-label="More rounds">+</button>
        </div>
      </div>
      <div className="sf-row col">
        <label>Games</label>
        <Seg value={s.mode} disabled={dis} onChange={(v) => patch({ mode: v })} options={[{ v: 'random', label: '🎲 Random' }, { v: 'categories', label: '🗂️ Categories' }, { v: 'playlist', label: '📋 Pick games' }]} />
      </div>
      {s.mode === 'categories' && (
        <div className="cat-picker">
          {CATEGORIES.map((c) => {
            const on = s.categories.includes(c.id);
            return (
              <button
                key={c.id}
                className={`cat-chip ${on ? 'on' : ''}`}
                disabled={dis}
                style={on ? { background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` } : undefined}
                onClick={() => patch({ categories: on ? s.categories.filter((x) => x !== c.id) : [...s.categories, c.id as CategoryId] })}
              >
                {c.emoji} {c.name}
              </button>
            );
          })}
          {s.categories.length === 0 && <span className="tiny muted">No category picked = all categories</span>}
        </div>
      )}
      {s.mode === 'playlist' && (
        <div className="stack-s">
          <div className="playlist-preview">
            {s.playlist.length === 0 && <span className="tiny muted">No games picked yet</span>}
            {s.playlist.map((id) => GAME_MAP[id] && <span key={id} className="chip">{GAME_MAP[id].emoji} {GAME_MAP[id].name}</span>)}
          </div>
          {editable && <button className="btn btn-blue btn-sm" onClick={onPickGames}>Choose games ({s.playlist.length})</button>}
        </div>
      )}
      <div className="sf-row col">
        <label>Difficulty</label>
        <Seg value={s.difficulty} disabled={dis} onChange={(v) => patch({ difficulty: v })} options={[{ v: 'easy', label: '😌 Easy' }, { v: 'normal', label: '🙂 Normal' }, { v: 'hard', label: '😈 Hard' }]} />
      </div>
      <div className="sf-row col">
        <label>Teams</label>
        <Seg value={s.teamMode} disabled={dis} onChange={(v) => patch({ teamMode: v })} options={[{ v: 'off', label: 'Free for all' }, { v: 'teams2', label: '2 teams' }, { v: 'teams3', label: '3 teams' }]} />
      </div>
      <div className="sf-row">
        <label>Max players</label>
        <div className="row-nw">
          <button className="btn btn-ghost btn-icon btn-sm" disabled={dis || s.maxPlayers <= 2} onClick={() => patch({ maxPlayers: s.maxPlayers - 1 })} aria-label="Fewer players">−</button>
          <span className="sf-num">{s.maxPlayers}</span>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={dis || s.maxPlayers >= 16} onClick={() => patch({ maxPlayers: s.maxPlayers + 1 })} aria-label="More players">+</button>
        </div>
      </div>
      <details className="sf-rules" open={editable}>
        <summary>Custom rules</summary>
        <div className="stack-s">
          <Toggle checked={s.allowRepeats} onChange={(v) => editable && patch({ allowRepeats: v })} label="Allow the same game twice" />
          <Toggle checked={s.rules.doubleFinal} onChange={(v) => editable && patch({ rules: { ...s.rules, doubleFinal: v } })} label="Final round counts double" />
          <Toggle checked={s.rules.speedMode} onChange={(v) => editable && patch({ rules: { ...s.rules, speedMode: v } })} label="Speed mode (faster timers)" />
          <Toggle checked={s.rules.underdog} onChange={(v) => editable && patch({ rules: { ...s.rules, underdog: v } })} label="Underdog boost (+15% for trailing players)" />
          <Toggle checked={s.rules.hideScores} onChange={(v) => editable && patch({ rules: { ...s.rules, hideScores: v } })} label="Secret scores until the end" />
        </div>
      </details>
      <div className="tiny muted">{compatible} games fit this many players.</div>
    </div>
  );
}

function GamePicker({ settings, onClose, players }: { settings: RoomSettings; onClose: () => void; players: number }) {
  const available = useStore((s) => s.available);
  const [list, setList] = useState<string[]>(settings.playlist);
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [q, setQ] = useState('');
  const games = CATALOG.filter((g) => available.has(g.id) && (cat === 'all' || g.category === cat) && (!q || g.name.toLowerCase().includes(q.toLowerCase())));
  const toggle = (id: string) => {
    sfx('select');
    setList((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= 40 ? l : [...l, id]));
  };
  return (
    <Modal open onClose={onClose} title={`Pick games (${list.length})`} wide>
      <div className="stack">
        <input className="input" placeholder="Search games..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tabs">
          <button className={`tab ${cat === 'all' ? 'on' : ''}`} style={{ color: cat === 'all' ? undefined : 'var(--ink)', background: cat === 'all' ? undefined : 'var(--paper-3)' }} onClick={() => setCat('all')}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`tab ${cat === c.id ? 'on' : ''}`} style={cat === c.id ? { background: c.color, color: '#fff' } : { color: 'var(--ink)', background: 'var(--paper-3)' }} onClick={() => setCat(c.id)}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <div className="picker-grid">
          {games.map((g) => (
            <GameTile key={g.id} meta={g} size="sm" selected={list.includes(g.id)} onClick={() => toggle(g.id)} badge={!supportsCount(g, Math.max(2, players)) ? `${g.minPlayers}+ players` : undefined} />
          ))}
        </div>
        <div className="row between">
          <button className="btn btn-white btn-sm" onClick={() => setList([])}>Clear</button>
          <div className="row-nw">
            <button className="btn btn-white" onClick={() => setList([...available].sort(() => Math.random() - 0.5).slice(0, settings.rounds))}>🎲 Surprise me</button>
            <button className="btn btn-green" onClick={() => { patch({ playlist: list, mode: 'playlist' }); onClose(); }}>Save playlist</button>
          </div>
        </div>
        <p className="tiny" style={{ color: 'var(--ink-soft)' }}>Category colours: {CATEGORIES.map((c) => CATEGORY_MAP[c.id].emoji).join(' ')}</p>
      </div>
    </Modal>
  );
}
