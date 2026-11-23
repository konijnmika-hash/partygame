import './team.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown } from '../../game/kit';
import { teamName } from '@shared/teams';
import { subscribeGameEvents } from '../../state/store';
import { serverNow } from '../../net/clock';
import { TeamBar, myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

const BLOCK = ['transparent', '#ff4f5f', '#3da9fc', '#ffd23f'];

interface Pub {
  k: number;
  n: number;
  phase: 'build' | 'reveal';
  deadline: number;
  size: number;
  colors: number;
  hints: string[];
  teams: string[][];
  architects: string[];
  boards: number[][];
  done: boolean[];
  teamScores: number[];
  blueprint: number[] | null;
  lastAcc: number[] | null;
}
interface Priv {
  role: 'architect' | 'builder' | 'solo';
  blueprint: number[] | null;
  pings: { i: number; c: number; at: number }[];
  hint: { h: number; at: number } | null;
}

export default function Construction({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const mine = myTeam(pub.teams, me);
  const [color, setColor] = useState(1);
  const [, tick] = useState(0);
  const board = pub.boards[mine] ?? [];
  const role = priv?.role ?? 'builder';
  const done = pub.done[mine];
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { team: number };
    if (ev.type === 'built') sfx(d.team === mine ? 'win' : 'ding');
  }, false), [mine]);
  useEffect(() => {
    if (priv?.pings.length) {
      sfx('blip');
      if (role === 'builder') vibrate(10);
    }
  }, [priv?.pings.length]);
  const cells = pub.size * pub.size;
  const now = serverNow();
  const pings = (priv?.pings ?? []).filter((p) => now - p.at < 3500 + 1000);
  const pingAt = new Map(pings.map((p) => [p.i, p.c]));
  const hint = priv?.hint && now - priv.hint.at < 4000 ? pub.hints[priv.hint.h] : null;
  const showBlueprint = pub.phase === 'reveal' ? pub.blueprint : priv?.blueprint;
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.teamScores} me={me} players={players} />
      <div className="small">Blueprint {pub.k + 1}/{pub.n} · Team {teamName(Math.max(0, mine))}</div>
      <Countdown deadline={pub.phase === 'build' ? pub.deadline : null} total={40000} />
      {pub.phase === 'build' && (
        <Banner
          title={done ? 'Built it! 🧱✓' : role === 'architect' ? '📐 You are the Architect' : role === 'solo' ? '🧱 Build it from memory!' : `🧱 Builder — follow ${nm(players, pub.architects[mine])}`}
          sub={role === 'architect' ? 'Tap a blueprint cell to ping it for your builders' : role === 'solo' ? 'Peek at the blueprint, then build it' : 'Pings show where to put which colour'}
          tone={role === 'architect' ? 'warn' : 'default'}
        />
      )}
      {hint && role !== 'architect' && <div className="hint-bubble">📣 {hint}</div>}
      <div className="row" style={{ gap: 14, justifyContent: 'center', alignItems: 'flex-start' }}>
        {showBlueprint && (
          <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
            <b className="small">Blueprint</b>
            <div className={`tgrid ${role === 'architect' && pub.phase === 'build' ? '' : 'small'}`} style={{ gridTemplateColumns: `repeat(${pub.size}, 1fr)` }}>
              {showBlueprint.map((c, i) => (
                <button
                  key={i}
                  className={`tcell ${pingAt.has(i) ? 'ping' : ''} ${board[i] === c && c ? 'locked' : ''}`}
                  style={{ background: c ? BLOCK[c] : undefined }}
                  disabled={!isPlayer || role !== 'architect' || pub.phase !== 'build' || done}
                  onClick={() => {
                    sfx('blip');
                    send({ t: 'ping', i, c });
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {(role !== 'architect' || pub.phase === 'reveal') && (
          <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
            <b className="small">Your team's build</b>
            <div className="tgrid" style={{ gridTemplateColumns: `repeat(${pub.size}, 1fr)` }}>
              {Array.from({ length: cells }, (_, i) => (
                <button
                  key={i}
                  className={`tcell ${pingAt.has(i) ? 'ping' : ''}`}
                  style={{ background: board[i] ? BLOCK[board[i]] : pingAt.has(i) ? `${BLOCK[pingAt.get(i)!]}55` : undefined }}
                  disabled={!isPlayer || role === 'architect' || pub.phase !== 'build' || done}
                  onClick={() => {
                    sfx('tap');
                    send({ t: 'place', i, c: board[i] === color ? 0 : color });
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {role === 'architect' && pub.phase === 'build' && (
          <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
            <b className="small">Their build</b>
            <div className="tgrid small" style={{ gridTemplateColumns: `repeat(${pub.size}, 1fr)` }}>
              {Array.from({ length: cells }, (_, i) => <span key={i} className="tcell" style={{ background: board[i] ? BLOCK[board[i]] : undefined }} />)}
            </div>
          </div>
        )}
      </div>
      {pub.phase === 'build' && role !== 'architect' && isPlayer && !done && (
        <div className="palette-row">
          {[1, 2, 3].map((c) => <button key={c} className={`pal ${color === c ? 'on' : ''}`} style={{ background: BLOCK[c] }} onClick={() => setColor(c)} aria-label={`Colour ${c}`} />)}
        </div>
      )}
      {pub.phase === 'build' && role === 'architect' && isPlayer && !done && (
        <div className="hint-row">
          {pub.hints.map((h, k) => <button key={k} className="hint-btn" onClick={() => send({ t: 'hint', h: k })}>{h}</button>)}
        </div>
      )}
      {pub.phase === 'reveal' && pub.lastAcc && <Banner title={`${Math.round((pub.lastAcc[mine] ?? 0) * 100)}% accurate`} tone={(pub.lastAcc[mine] ?? 0) >= 0.9 ? 'good' : 'default'} />}
    </div>
  );
}
