import { P2P } from '../p2p/mode';
import { useEffect, useMemo, useState } from 'react';
import type { PublicRoomInfo } from '@shared/types';
import { CATALOG } from '@shared/catalog/index';
import { CATEGORIES } from '@shared/categories';
import { normalizeRoomCode } from '@shared/validation';
import { go, toast, useStore } from '../state/store';
import { createRoom, emitAck, joinRoom, quickPlay } from '../net/socket';
import { Avatar, LevelBadge, Logo } from '../components/ui';
import { SoundToggles } from '../components/TopBar';
import { GameTile } from '../components/GameTile';
import { sfx } from '../audio/sfx';

export function Home() {
  const profile = useStore((s) => s.profile)!;
  const online = useStore((s) => s.online);
  const connected = useStore((s) => s.connected);
  const available = useStore((s) => s.available);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rooms, setRooms] = useState<PublicRoomInfo[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await emitAck<{ online: number; rooms: PublicRoomInfo[] }>('presence:list');
      if (alive && r.ok && r.data) setRooms(r.data.rooms);
    };
    if (connected) load();
    const id = setInterval(() => connected && load(), 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [connected]);

  const featured = useMemo(() => {
    const avail = CATALOG.filter((g) => available.has(g.id));
    const pool = avail.length ? avail : CATALOG;
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
  }, [available.size]);

  const run = async (key: string, fn: () => Promise<boolean>) => {
    if (busy) return;
    if (!connected) return toast('Connecting to the party server...', 'info');
    sfx('click');
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const join = () => {
    const c = normalizeRoomCode(code);
    if (!c) {
      sfx('wrong');
      return toast('Room codes are 4 letters, like BLOP', 'error');
    }
    run('join', () => joinRoom(c));
  };

  const xpPct = profile.xpForNext ? Math.round((profile.xpIntoLevel / profile.xpForNext) * 100) : 100;
  const nGames = available.size || CATALOG.length;

  return (
    <div className="page home">
      <header className="home-top">
        <div className="online-pill" title="Players online">
          <span className={`dot ${connected ? 'on' : ''}`} /> {P2P ? 'Make a room, share the link!' : connected ? `${online.toLocaleString()} online` : 'connecting...'}
        </div>
        <SoundToggles />
      </header>

      <section className="hero anim-up">
        <div className="hero-logo">
          <span className="hero-bloop l"><Avatar avatar={{ color: 'c-sky', eyes: 'e-happy', mouth: 'm-open', hat: 'h-party', acc: 'a-blush' }} size={76} bob /></span>
          <Logo size={1.25} />
          <span className="hero-bloop r"><Avatar avatar={{ color: 'c-sunny', eyes: 'e-star', mouth: 'm-grin', hat: 'h-propeller', acc: 'a-bowtie' }} size={70} bob /></span>
        </div>
        <p className="hero-tag">{nGames} chaotic minigame{nGames === 1 ? '' : 's'} · phones, tablets & PCs · play with friends</p>
      </section>

      <section className="home-grid">
        <button className="profile-card card anim-up" onClick={() => { sfx('click'); go('profile'); }} aria-label="Open your profile">
          <Avatar avatar={profile.avatar} size={84} bob />
          <div className="pc-info">
            <div className="row-nw">
              <LevelBadge level={profile.level} />
              <strong className="pc-name">{profile.name}</strong>
            </div>
            <div className="pc-title">{profile.title}</div>
            <div className="bar xp" aria-label={`XP ${profile.xpIntoLevel} of ${profile.xpForNext}`}>
              <span style={{ width: `${xpPct}%` }} />
            </div>
            <div className="tiny muted">{profile.xpIntoLevel} / {profile.xpForNext} XP · tap to customise ✏️</div>
          </div>
        </button>

        <div className="home-actions">
          {!P2P && <button className="btn btn-pink btn-xl btn-block play-btn" onClick={() => run('quick', quickPlay)} disabled={!!busy}>
            <span className="emoji">⚡</span> {busy === 'quick' ? 'Finding a party...' : 'Quick Play'}
          </button>}
          <button className="btn btn-purple btn-xl btn-block" onClick={() => run('create', () => createRoom(profile.settings?.lastRoomSettings ?? null))} disabled={!!busy}>
            <span className="emoji">🎉</span> {busy === 'create' ? 'Creating...' : 'Create Room'}
          </button>
          <form
            className="join-box"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <input
              className="input input-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
              placeholder="CODE"
              aria-label="Room code"
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
            />
            <button className="btn btn-cyan btn-lg" type="submit" disabled={!!busy || code.length !== 4}>
              Join
            </button>
          </form>
        </div>
      </section>

      <nav className="home-nav">
        {[
          { k: 'catalog', e: '🎮', t: `${nGames} Games` },
          { k: 'leaderboard', e: '🏆', t: 'Leaderboards' },
          { k: 'friends', e: '👯', t: 'Friends' },
          { k: 'profile', e: '🏅', t: 'Profile' },
          { k: 'settings', e: '⚙️', t: 'Settings' },
        ].filter((n) => !P2P || (n.k !== 'leaderboard' && n.k !== 'friends')).map((n) => (
          <button key={n.k} className="nav-tile" onClick={() => { sfx('click'); go(n.k as any); }}>
            <span className="nav-emoji">{n.e}</span>
            <span>{n.t}</span>
          </button>
        ))}
      </nav>

      {rooms.length > 0 && (
        <section className="glass anim-up">
          <div className="panel-title">🌍 Public parties</div>
          <div className="public-rooms">
            {rooms.map((r) => (
              <button key={r.code} className="pr-item" onClick={() => run('join', () => joinRoom(r.code))}>
                <span className="pr-code">{r.code}</span>
                <span className="grow">{r.hostName}'s party</span>
                <span className="chip">{r.players}/{r.maxPlayers}</span>
                <span className={`chip ${r.phase === 'lobby' ? 'chip-green' : ''}`}>{r.phase === 'lobby' ? 'In lobby' : 'Playing'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <div className="row between">
          <div className="panel-title" style={{ margin: 0 }}>✨ Try these</div>
          <button className="btn btn-ghost btn-sm" onClick={() => go('catalog')}>See all</button>
        </div>
        <div className="tile-scroller">
          {featured.map((m) => (
            <GameTile key={m.id} meta={m} onClick={() => go('catalog')} />
          ))}
        </div>
        <div className="cat-pills">
          {CATEGORIES.map((c) => (
            <span key={c.id} className="cat-pill" style={{ background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` }}>
              {c.emoji} {c.name}
            </span>
          ))}
        </div>
      </section>
      <footer className="home-foot tiny muted">Bloop Bash · original party game · made for chaos with friends</footer>
    </div>
  );
}
