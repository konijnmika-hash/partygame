import { useEffect, useState } from 'react';
import type { LeaderboardRow, LeaderboardScope } from '@shared/types';
import { api } from '../net/api';
import { TopBar } from '../components/TopBar';
import { Avatar, LevelBadge, Rank, Spinner } from '../components/ui';
import { sfx } from '../audio/sfx';
import { useStore } from '../state/store';

const SCOPES: { v: LeaderboardScope; label: string; blurb: string }[] = [
  { v: 'daily', label: '☀️ Today', blurb: 'Resets every day at 00:00 UTC' },
  { v: 'weekly', label: '📅 This week', blurb: 'Resets every Monday at 00:00 UTC' },
  { v: 'alltime', label: '🏛️ All time', blurb: 'The hall of fame' },
  { v: 'friends', label: '👯 Friends', blurb: 'You and your friends, all time' },
];

export default function Leaderboard() {
  const [scope, setScope] = useState<LeaderboardScope>('weekly');
  const [data, setData] = useState<{ rows: LeaderboardRow[]; me: LeaderboardRow | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const profile = useStore((s) => s.profile!);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    api<{ rows: LeaderboardRow[]; me: LeaderboardRow | null }>(`/leaderboard?scope=${scope}`).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setData(r.data);
      else setErr(r.error || 'Could not load');
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  const meInList = data?.rows.some((r) => r.isMe);
  return (
    <div className="page">
      <TopBar title="🏆 Leaderboards" />
      <div className="tabs" role="tablist">
        {SCOPES.map((s) => (
          <button key={s.v} role="tab" aria-selected={scope === s.v} className={`tab ${scope === s.v ? 'on' : ''}`} onClick={() => { sfx('select'); setScope(s.v); }}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: '8px 2px 12px' }}>
        {SCOPES.find((s) => s.v === scope)?.blurb}. Points from rounds with bots count proportionally to the share of human players.
      </p>
      <div className="lb-list glass">
        {!data && !err && <div className="centered" style={{ padding: 40 }}><Spinner /></div>}
        {err && <div className="empty">{err}</div>}
        {data && data.rows.length === 0 && (
          <div className="empty">{scope === 'friends' ? 'Add some friends to compare scores!' : 'Nobody has scored yet — play a round and claim the top spot!'}</div>
        )}
        {data?.rows.map((r) => <LbRow key={r.id} r={r} />)}
        {data && !meInList && data.me && (
          <>
            <div className="lb-sep">···</div>
            <LbRow r={{ ...data.me, name: profile.name, avatar: profile.avatar, level: profile.level, title: profile.title }} />
          </>
        )}
      </div>
    </div>
  );
}

function LbRow({ r }: { r: LeaderboardRow }) {
  return (
    <div className={`lb-row ${r.isMe ? 'me' : ''}`}>
      <Rank rank={r.rank} />
      <Avatar avatar={r.avatar} size={40} />
      <div className="lb-who">
        <div className="row-nw">
          <b className="lb-name">{r.name}</b>
          {r.online && <span className="dot on" title="Online" />}
        </div>
        <div className="tiny muted">{r.title}</div>
      </div>
      <LevelBadge level={r.level} />
      <div className="lb-stats">
        <div className="lb-pts">{r.points.toLocaleString()}</div>
        <div className="tiny muted">{r.wins} wins · {r.rounds} rounds</div>
      </div>
    </div>
  );
}
