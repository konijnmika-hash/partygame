import './team.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, SecondsLeft, TextEntry } from '../../game/kit';
import { teamName } from '@shared/teams';
import { subscribeGameEvents, toast } from '../../state/store';
import { TeamBar, myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx } from '../../audio/sfx';

interface TS { giver: string; clues: string[]; guesses: { id: string; g: string; ok: boolean }[]; got: number; skips: number; len: number; wordAt: number; solo: boolean }
interface Pub { startedAt: number; endsAt: number; teams: string[][]; ts: TS[] }

export default function TeamWord({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { word: string | null }>) {
  const mine = myTeam(pub.teams, me);
  const st = mine >= 0 ? pub.ts[mine] : null;
  const giving = !!priv?.word;
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { team?: number; word?: string; reason?: string };
    if (ev.type === 'got') {
      if (d.team === mine) {
        sfx('correct');
        toast(`✅ “${d.word}”!`, 'success');
      } else sfx('ding', 0.8);
    } else if (ev.type === 'badClue') {
      sfx('wrong');
      toast(d.reason ?? 'Invalid clue', 'error');
    }
  }, false), [mine]);
  useEffect(() => {
    if (st?.clues.length) sfx('pop');
  }, [st?.clues.length]);
  if (!st) return <div className="g-stage" />;
  const canSkip = giving && st.skips < 3;
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.ts.map((x) => x.got)} me={me} players={players} fmt={(v) => `${v} 🗝️`} />
      <div className="row-nw" style={{ gap: 10 }}>
        <SecondsLeft deadline={pub.endsAt} />
        <b>Team {teamName(mine)}</b>
      </div>
      {giving ? (
        <>
          <Banner title="You give the clues!" sub="One word at a time — no part of the secret word" tone="warn" />
          <div className="secret-word">{priv!.word}</div>
          {isPlayer && st.clues.length < 3 && <TextEntry placeholder="One-word clue…" button="Give clue" onSubmit={(c) => send({ t: 'clue', c })} />}
          {canSkip && <button className="btn" onClick={() => send({ t: 'skip' })}>Skip word ({3 - st.skips} left)</button>}
        </>
      ) : (
        <>
          <Banner title={st.solo ? 'Guess the word from the clues!' : `${nm(players, st.giver)} gives the clues`} sub={`${st.len} letters`} />
          {isPlayer && st.clues.length > 0 && <TextEntry placeholder="Your guess…" button="Guess" onSubmit={(g) => send({ t: 'guess', g })} />}
        </>
      )}
      <div className="clue-list">
        {st.clues.length ? st.clues.map((c, i) => <span key={i} className="clue">{c}</span>) : <span className="small">Waiting for the first clue…</span>}
      </div>
      <div className="guess-feed">
        {[...st.guesses].reverse().map((g, i) => (
          <div key={i} className={g.ok ? 'ok' : ''}>{nm(players, g.id)}: {g.g} {g.ok ? '✅' : ''}</div>
        ))}
      </div>
    </div>
  );
}
