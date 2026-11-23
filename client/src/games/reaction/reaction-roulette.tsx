import './reaction.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, DPad, MiniScores, RoundDots, Stage, TapZone, useChangedAt, useRafNow, nameOf } from '../../game/kit';
import { sfx, vibrate } from '../../audio/sfx';
import { subscribeGameEvents } from '../../state/store';

type Kind = 'color' | 'needle' | 'count' | 'arrow' | 'odd';
interface Pub {
  spin: number;
  n: number;
  phase: 'spin' | 'play' | 'result';
  kind: Kind;
  title: string;
  params: any;
  startAt: number;
  color: string | null;
  colorName: string | null;
  done: string[];
  results: Record<string, { ok: boolean; val: number; pts: number }> | null;
  scores: Record<string, number>;
}
interface Priv {
  count: number;
  arrow: string | null;
  arrowIdx: number;
  res: { ok: boolean } | null;
}

const ICON: Record<Kind, string> = { color: '🎨', needle: '🧭', count: '🔢', arrow: '➡️', odd: '🔍' };
const ARROW: Record<string, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };

export default function ReactionRoulette({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const playing = pub.phase === 'play';
  const done = pub.done.includes(me) || !!priv?.res;
  const colorShown = useChangedAt(pub.color);
  const playShown = useChangedAt(pub.phase === 'play' ? pub.startAt : 0);
  const now = useRafNow();
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (pub.phase === 'spin') sfx('whoosh');
    if (pub.phase === 'play') sfx('go');
  }, [pub.phase, pub.spin]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'wrong') {
      sfx('wrong');
      setShake((x) => x + 1);
    }
  }, false), []);

  let body: React.ReactNode = null;
  if (pub.phase === 'spin') {
    body = (
      <div className="rr-wheel">
        <div className="rr-spinner">{Object.values(ICON).map((e, i) => <span key={i} style={{ transform: `rotate(${i * 72}deg) translateY(-90px)` }}>{e}</span>)}</div>
        <div className="rr-pick anim-pop" key={pub.spin}>{ICON[pub.kind]}</div>
        <Banner title={pub.title} sub={`Spin ${pub.spin + 1} of ${pub.n}`} />
      </div>
    );
  } else if (pub.phase === 'result' && pub.results) {
    const rows = Object.entries(pub.results).sort((a, b) => b[1].pts - a[1].pts);
    body = (
      <div className="stack" style={{ alignItems: 'center' }}>
        <Banner title={pub.results[me]?.ok ? `+${pub.results[me].pts} points!` : pub.results[me]?.pts ? `+${pub.results[me].pts} (close!)` : 'Missed it!'} tone={pub.results[me]?.ok ? 'good' : 'bad'} big />
        <div className="row" style={{ justifyContent: 'center' }}>
          {rows.map(([id, r]) => <span key={id} className={`chip ${id === me ? 'chip-yellow' : r.ok ? 'chip-green' : 'chip-dark'}`}>{nameOf(players, id)} +{r.pts}</span>)}
        </div>
      </div>
    );
  } else if (playing) {
    const p = pub.params;
    if (done) body = <Banner title={priv?.res?.ok === false ? 'Oops! ❌' : 'Done! ✅'} sub="Waiting for the others..." />;
    else if (pub.kind === 'color') {
      body = (
        <TapZone onTap={() => { send({ t: 'tap', ms: Math.round(performance.now() - colorShown.current) }); sfx('tap'); }} disabled={!isPlayer}>
          <Banner title={<>Tap on <span style={{ color: p.targetHex }}>{p.targetName}</span>!</>} />
          <div className="rr-color" style={{ background: pub.color ?? '#555' }} />
        </TapZone>
      );
    } else if (pub.kind === 'needle') {
      const el = Math.max(0, now - pub.startAt);
      const ph = (el % p.period) / p.period;
      const pos = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      body = (
        <TapZone onTap={() => { send({ t: 'tap', ms: Math.round(performance.now() - playShown.current) }); sfx('tap'); }} disabled={!isPlayer}>
          <svg className="rr-gauge" viewBox="0 0 200 120">
            <path d="M10 110 A90 90 0 0 1 190 110" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="18" strokeLinecap="round" />
            <path d={arc(p.center - p.half, p.center + p.half)} fill="none" stroke="#34cf78" strokeWidth="18" />
            <line x1="100" y1="110" x2={100 - Math.cos(pos * Math.PI) * 85} y2={110 - Math.sin(pos * Math.PI) * 85} stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <circle cx="100" cy="110" r="9" fill="#ffd23f" />
          </svg>
          <Banner title="TAP to stop the needle!" />
        </TapZone>
      );
    } else if (pub.kind === 'count') {
      body = (
        <TapZone onTap={() => { send({ t: 'tap' }); sfx('tap', 1 + (priv?.count ?? 0) * 0.04); vibrate(8); }} disabled={!isPlayer}>
          <Banner title={`Tap exactly ${p.n} times!`} sub="Not one more..." />
          <div className="rr-count">{priv?.count ?? 0}</div>
        </TapZone>
      );
    } else if (pub.kind === 'arrow') {
      body = (
        <div className={`stack ${shake ? 'anim-shake' : ''}`} key={shake} style={{ alignItems: 'center' }}>
          <Banner title="Press the arrow!" sub={`${priv?.arrowIdx ?? 0} / ${p.len}`} />
          <div className="rr-arrow">{priv?.arrow ? ARROW[priv.arrow] : '…'}</div>
          <DPad disabled={!isPlayer} onDir={(d) => { send({ t: 'dir', d }); sfx('tap'); }} />
        </div>
      );
    } else if (pub.kind === 'odd') {
      const cols = Math.ceil(Math.sqrt(p.grid.length));
      body = (
        <div className="stack" style={{ alignItems: 'center', width: '100%' }}>
          <Banner title="Find the odd one!" />
          <div className="board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: 'min(100%, 50dvh, 440px)' }}>
            {p.grid.map((e: string, i: number) => (
              <button key={i} className="cell" style={{ fontSize: 'clamp(1.2rem,5vw,2rem)' }} disabled={!isPlayer} onPointerDown={() => { send({ t: 'pick', i }); sfx('tap'); }}>{e}</button>
            ))}
          </div>
        </div>
      );
    }
  }

  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.spin} />
      <div className="rr-body">{body}</div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}

function arc(a: number, b: number): string {
  const pt = (t: number) => `${100 - Math.cos(t * Math.PI) * 90} ${110 - Math.sin(t * Math.PI) * 90}`;
  return `M${pt(Math.max(0, a))} A90 90 0 0 1 ${pt(Math.min(1, b))}`;
}
