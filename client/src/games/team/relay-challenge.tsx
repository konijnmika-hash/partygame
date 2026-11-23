import './team.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, NumPad, SecondsLeft, TextEntry, useKeys } from '../../game/kit';
import { teamColor, teamName } from '@shared/teams';
import { subscribeGameEvents } from '../../state/store';
import { myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

type Leg =
  | { k: 'mash'; need: number }
  | { k: 'math'; probs: { q: string; a: number }[] }
  | { k: 'aim'; targets: { x: number; y: number }[] }
  | { k: 'order'; cells: number[] }
  | { k: 'type'; word: string };

interface TS { leg: number; prog: number; lockUntil: number; finished: number | null; finishMs: number | null; legStart: number; runner: string | null }
interface Pub { startedAt: number; endsAt: number; legs: Leg[]; teams: string[][]; ts: TS[] }

const LEG_NAMES: Record<Leg['k'], string> = { mash: '👊 Mash', math: '🧮 Maths', aim: '🎯 Aim', order: '🔢 In order', type: '⌨️ Type' };

function legTotal(l: Leg): number {
  return l.k === 'mash' ? l.need : l.k === 'math' ? l.probs.length : l.k === 'aim' ? l.targets.length : l.k === 'order' ? l.cells.length : 1;
}

function Task({ leg, st, send }: { leg: Leg; st: TS; send: (a: Record<string, unknown>) => void }) {
  useKeys((k) => {
    if (leg.k === 'mash' && (k === ' ' || k === 'Enter')) {
      sfx('tap', 1 + st.prog / 40);
      send({ t: 'tap' });
    }
  }, leg.k === 'mash');
  if (leg.k === 'mash') {
    return (
      <button className="tug-btn" style={{ background: 'var(--pink)' }} onPointerDown={(e) => { e.preventDefault(); vibrate(5); sfx('tap', 1 + st.prog / 40); send({ t: 'tap' }); }}>
        MASH! {st.prog}/{leg.need}
      </button>
    );
  }
  if (leg.k === 'math') {
    const p = leg.probs[st.prog];
    return (
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="g-prompt"><small>Problem {st.prog + 1}/{leg.probs.length}</small>{p?.q} = ?</div>
        <NumPad key={st.prog} onSubmit={(v) => send({ t: 'ans', v: Number(v) })} />
      </div>
    );
  }
  if (leg.k === 'aim') {
    const t = leg.targets[st.prog];
    return (
      <div className="aim-box">
        {t && <button key={st.prog} className="aim-target" style={{ left: `${t.x}%`, top: `${t.y}%` }} onPointerDown={(e) => { e.preventDefault(); sfx('pop'); send({ t: 'hit', i: st.prog }); }} aria-label="Target" />}
      </div>
    );
  }
  if (leg.k === 'order') {
    return (
      <div className="order-grid">
        {Array.from({ length: 16 }, (_, c) => {
          const k = leg.cells.indexOf(c);
          const num = k >= 0 ? k + 1 : null;
          const used = num != null && num <= st.prog;
          return (
            <button key={c} className={`order-cell ${num ? 'num' : ''} ${used ? 'used' : ''}`} disabled={!num || used} onClick={() => { sfx('tap'); send({ t: 'num', v: num }); }}>
              {num ?? ''}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <div className="secret-word">{leg.word}</div>
      <TextEntry placeholder="Type it!" button="Go" onSubmit={(w) => send({ t: 'word', w })} />
    </div>
  );
}

export default function RelayChallenge({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const mine = myTeam(pub.teams, me);
  const st = mine >= 0 ? pub.ts[mine] : null;
  const myLeg = st && st.runner === me && st.finished == null;
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { team: number; to?: string; place?: number };
    if (ev.type === 'baton' && d.to === me) {
      sfx('ding');
      vibrate([60, 30, 60]);
    } else if (ev.type === 'baton') sfx('whoosh');
    else if (ev.type === 'finish') sfx(d.team === mine ? 'win' : 'ding');
  }, false), [me, mine]);
  const leg = st ? pub.legs[st.leg] : null;
  return (
    <div className="g-stage">
      <div className="row-nw" style={{ gap: 10 }}>
        <SecondsLeft deadline={pub.endsAt} />
        <b>{pub.legs.length} legs: {pub.legs.map((l) => LEG_NAMES[l.k].split(' ')[0]).join(' ')}</b>
      </div>
      <div className="relay-track">
        {pub.teams.map((_members, t) => {
          const x = pub.ts[t];
          const r = x.runner ? player(x.runner) : null;
          return (
            <div key={t} className={`relay-row ${t === mine ? 'mine' : ''}`} style={{ borderLeft: `8px solid ${teamColor(t)}` }}>
              <b style={{ minWidth: 54 }}>{teamName(t)}</b>
              {r ? <Avatar avatar={r.avatar} size={28} /> : <span>🏁</span>}
              <div className="relay-legs">
                {pub.legs.map((l, k) => (
                  <i key={k} className={k < x.leg ? 'done' : k === x.leg && x.finished == null ? 'now' : ''} style={{ ['--p' as any]: `${Math.round((x.prog / legTotal(l)) * 100)}%` }} />
                ))}
              </div>
              {x.finished != null && <span className="chip chip-yellow">#{x.finished}</span>}
            </div>
          );
        })}
      </div>
      {st?.finished != null ? (
        <Banner title={`🏁 Team ${teamName(mine)} finished #${st.finished}!`} tone="good" big />
      ) : myLeg && leg && isPlayer ? (
        <>
          <Banner title={`Your leg: ${LEG_NAMES[leg.k]}`} sub={`Leg ${st!.leg + 1} of ${pub.legs.length}`} tone="warn" />
          <Task leg={leg} st={st!} send={send} />
        </>
      ) : st && leg ? (
        <Banner title={`📣 Cheer on ${nm(players, st.runner)}!`} sub={`${LEG_NAMES[leg.k]} — ${st.prog}/${legTotal(leg)}`} />
      ) : null}
    </div>
  );
}
