import { useEffect, useMemo, useState } from 'react';
import { GAME_MAP } from '@shared/catalog/index';
import { CATEGORY_MAP } from '@shared/categories';
import type { RoomMember } from '@shared/types';
import { useStore } from '../state/store';
import { emit } from '../net/socket';
import { Avatar, CountUp, Rank, useNow } from '../components/ui';
import { Confetti } from '../components/Confetti';
import { sfx } from '../audio/sfx';
import { teamColor, teamName } from './Lobby';

function useContinue() {
  const room = useStore((s) => s.room!);
  const me = useStore((s) => s.profile!.id);
  const now = useNow(250);
  const left = room.phaseEndsAt ? Math.max(0, Math.ceil((room.phaseEndsAt - now) / 1000)) : 0;
  const ready = !!room.members.find((m) => m.id === me)?.ready;
  return { left, ready, go: () => { sfx('click'); emit('room:skip'); } };
}

export function Results() {
  const results = useStore((s) => s.results);
  const room = useStore((s) => s.room!);
  const me = useStore((s) => s.profile!.id);
  const [open, setOpen] = useState<string | null>(me);
  const c = useContinue();
  const members = room.members;
  const byId = (id: string) => members.find((m) => m.id === id);
  const myRes = results?.players.find((p) => p.id === me);
  useEffect(() => {
    if (!myRes) return;
    sfx(myRes.rank === 1 ? 'win' : myRes.rank <= 3 ? 'correct' : 'coin');
  }, [results?.index]);
  if (!results) return <div className="page centered"><div className="spinner" /></div>;
  const meta = GAME_MAP[results.gameId];
  const cat = CATEGORY_MAP[meta.category];
  const top = results.players.slice(0, 3);
  const hide = room.settings.rules.hideScores;
  return (
    <div className="page results" style={{ ['--g1' as any]: cat.gradient[0], ['--g2' as any]: cat.gradient[1] }}>
      <Confetti fire={myRes?.rank === 1 ? results.index + 1 : 0} />
      <header className="res-head anim-up">
        <span className="chip chip-dark">Round {results.index + 1} results</span>
        <h1>{meta.emoji} {meta.name}</h1>
      </header>
      <div className="podium anim-pop">
        {[1, 0, 2].map((i) => {
          const p = top[i];
          if (!p) return <div key={i} className="pod-slot empty" />;
          const m = byId(p.id);
          return (
            <div key={p.id} className={`pod-slot place-${i + 1}`}>
              {m && <Avatar avatar={m.avatar} size={i === 0 ? 86 : 64} bob mood={i === 0 ? 'happy' : undefined} />}
              <div className="pod-name">{m?.name ?? '???'}</div>
              <div className="pod-pts">{hide ? '???' : <CountUp value={p.points} />}</div>
              <div className="pod-block"><Rank rank={p.rank} /></div>
            </div>
          );
        })}
      </div>
      {results.summary.length > 0 && (
        <div className="res-summary">
          {results.summary.map((s, i) => <div key={i} className="chip chip-dark">{s}</div>)}
        </div>
      )}
      {results.teams && results.teams.length > 0 && (
        <div className="team-res">
          {results.teams.map((t) => (
            <div key={t.team} className="team-res-item" style={{ background: teamColor(t.team) }}>
              {teamName(t.team)} team: +{t.points}
            </div>
          ))}
        </div>
      )}
      <div className="res-list">
        {results.players.map((p, i) => {
          const m = byId(p.id);
          const isOpen = open === p.id;
          return (
            <div key={p.id} className={`res-row anim-up ${p.id === me ? 'me' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
              <button className="res-main" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                <Rank rank={p.rank} />
                {m && <Avatar avatar={m.avatar} size={40} />}
                <span className="res-name">
                  {m?.name ?? 'Player left'}
                  {p.highlight && <span className="res-hl">{p.highlight}</span>}
                </span>
                {p.xp ? <span className="chip chip-blue">+{p.xp} XP</span> : null}
                <span className="res-pts">{hide ? '???' : <>+<CountUp value={p.sessionPoints} /></>}</span>
              </button>
              {isOpen && !hide && (
                <div className="breakdown">
                  {p.breakdown.map((b, j) => (
                    <div key={j} className="bd-line"><span>{b.label}</span><b>+{b.pts}</b></div>
                  ))}
                  <div className="bd-line total"><span>Round score (max 1000)</span><b>{p.points}</b></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="continue-bar">
        <button className="btn btn-pink btn-lg" onClick={c.go} disabled={c.ready}>{c.ready ? 'Waiting...' : 'Continue'} <span className="chip chip-dark">{c.left}s</span></button>
      </div>
    </div>
  );
}

export function Standings() {
  const room = useStore((s) => s.room!);
  const me = useStore((s) => s.profile!.id);
  const c = useContinue();
  const rows = room.standings;
  const byId = (id: string): RoomMember | undefined => room.members.find((m) => m.id === id);
  const next = room.round && room.round.index + 1 < room.round.total ? room.round.index + 2 : null;
  const maxPts = Math.max(1, ...rows.map((r) => r.points));
  const order = useMemo(() => rows.map((r) => r.id).join(), [rows]);
  useEffect(() => sfx('whoosh'), [order]);
  return (
    <div className="page standings">
      <header className="res-head anim-up">
        <span className="chip chip-dark">{next ? `After round ${next - 1} of ${room.round!.total}` : 'Final round done!'}</span>
        <h1>🏆 Party standings</h1>
      </header>
      {room.teamStandings.length > 0 && (
        <div className="team-res">
          {room.teamStandings.map((t) => (
            <div key={t.team} className="team-res-item big" style={{ background: teamColor(t.team) }}>
              #{t.rank} {teamName(t.team)} · {t.points.toLocaleString()}
            </div>
          ))}
        </div>
      )}
      <div className="stand-list">
        {rows.map((r, i) => {
          const m = byId(r.id);
          return (
            <div key={r.id} className={`stand-row ${r.id === me ? 'me' : ''}`} style={{ animationDelay: `${i * 0.07}s` }}>
              <Rank rank={r.rank} />
              {m && <Avatar avatar={m.avatar} size={44} bob={r.rank === 1} />}
              <div className="stand-mid">
                <div className="row-nw between">
                  <span className="res-name">{m?.name ?? 'Player left'} {m && m.wins > 0 && <span className="chip">🏅 {m.wins}</span>}</span>
                  <span className="stand-pts"><CountUp value={r.points} /></span>
                </div>
                <div className="bar"><span style={{ width: `${(r.points / maxPts) * 100}%`, background: m?.team != null ? teamColor(m.team) : undefined }} /></div>
              </div>
              <span className={`delta ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}`}>{r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${-r.delta}` : '–'}</span>
            </div>
          );
        })}
      </div>
      <div className="continue-bar">
        <button className="btn btn-pink btn-lg" onClick={c.go} disabled={c.ready}>{next ? `Next: round ${next}` : 'See the winners'} <span className="chip chip-dark">{c.left}s</span></button>
      </div>
    </div>
  );
}
