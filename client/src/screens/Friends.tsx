import { useEffect, useState } from 'react';
import type { FriendInfo } from '@shared/types';
import { api } from '../net/api';
import { emit, joinRoom } from '../net/socket';
import { toast, useStore } from '../state/store';
import { TopBar } from '../components/TopBar';
import { Avatar, LevelBadge, Spinner } from '../components/ui';
import { sfx } from '../audio/sfx';
import { ACHIEVEMENT_MAP } from '@shared/achievements';

export default function Friends() {
  const [list, setList] = useState<FriendInfo[] | null>(null);
  const [name, setName] = useState('');
  const room = useStore((s) => s.room);
  const online = useStore((s) => s.online);
  const profile = useStore((s) => s.profile!);

  const load = async () => {
    const r = await api<FriendInfo[]>('/friends');
    setList(r.ok && r.data ? r.data : []);
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [online]);

  const progress = (p: any) => {
    for (const a of p?.achievements || []) {
      const d = ACHIEVEMENT_MAP[a];
      if (d) toast(`Achievement unlocked: ${d.name}`, 'achievement', { emoji: d.emoji });
    }
  };

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const r = await api('/friends/request', { method: 'POST', body: { username: n } });
    if (!r.ok) {
      sfx('wrong');
      return toast(r.error || 'Could not send request', 'error');
    }
    sfx('correct');
    toast(r.data.result === 'accepted' ? `You and ${n} are now friends!` : `Friend request sent to ${n}`, 'success');
    progress(r.progress);
    setName('');
    load();
  };
  const accept = async (id: string) => {
    const r = await api('/friends/accept', { method: 'POST', body: { id } });
    if (!r.ok) return toast(r.error || 'Failed', 'error');
    sfx('correct');
    progress(r.progress);
    load();
  };
  const remove = async (id: string) => {
    await api('/friends/remove', { method: 'POST', body: { id } });
    sfx('swap');
    load();
  };
  const invite = (f: FriendInfo) => {
    emit('friend:invite', f.id);
    sfx('pop');
    toast(`Invite sent to ${f.name}`, 'success', { emoji: '💌' });
  };

  const incoming = list?.filter((f) => f.status === 'incoming') ?? [];
  const outgoing = list?.filter((f) => f.status === 'outgoing') ?? [];
  const friends = (list?.filter((f) => f.status === 'friends') ?? []).sort((a, b) => Number(b.online) - Number(a.online));

  return (
    <div className="page">
      <TopBar title="👯 Friends" />
      <section className="glass stack">
        <div className="panel-title">➕ Add a friend</div>
        <form className="row-nw" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Their username" maxLength={16} aria-label="Friend username" />
          <button className="btn btn-pink" type="submit" disabled={!name.trim()}>Send</button>
        </form>
        <div className="tiny muted">Your username is <b>{profile.name}</b> — share it so friends can add you.</div>
      </section>
      {!list && <div className="centered" style={{ padding: 30 }}><Spinner /></div>}
      {incoming.length > 0 && (
        <section className="glass stack-s" style={{ marginTop: 14 }}>
          <div className="panel-title">📬 Requests</div>
          {incoming.map((f) => (
            <div key={f.id} className="friend-row">
              <Avatar avatar={f.avatar} size={40} />
              <b className="grow">{f.name}</b>
              <button className="btn btn-green btn-sm" onClick={() => accept(f.id)}>Accept</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(f.id)}>Decline</button>
            </div>
          ))}
        </section>
      )}
      <section className="glass stack-s" style={{ marginTop: 14 }}>
        <div className="panel-title">👥 Friends ({friends.length})</div>
        {list && friends.length === 0 && <div className="empty">No friends yet — add someone by username, or play a public party and make some!</div>}
        {friends.map((f) => (
          <div key={f.id} className="friend-row">
            <span className={`dot ${f.online ? 'on' : ''}`} />
            <Avatar avatar={f.avatar} size={42} />
            <div className="grow">
              <div className="row-nw"><b>{f.name}</b> <LevelBadge level={f.level} /></div>
              <div className="tiny muted">{f.activity}</div>
            </div>
            {f.roomCode && room?.code !== f.roomCode && <button className="btn btn-cyan btn-sm" onClick={() => joinRoom(f.roomCode!)}>Join</button>}
            {room && !room.isPublic && f.online && room.code !== f.roomCode && <button className="btn btn-pink btn-sm" onClick={() => invite(f)}>Invite</button>}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`}>✕</button>
          </div>
        ))}
      </section>
      {outgoing.length > 0 && (
        <section className="glass stack-s" style={{ marginTop: 14 }}>
          <div className="panel-title">⏳ Pending</div>
          {outgoing.map((f) => (
            <div key={f.id} className="friend-row">
              <Avatar avatar={f.avatar} size={34} />
              <span className="grow">{f.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(f.id)}>Cancel</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
