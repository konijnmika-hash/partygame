import './puzzle.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, MiniScores, SecondsLeft, Stage } from '../../game/kit';
import { LetterTiles } from '../../game/LetterTiles';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  letters: string;
  endsAt: number;
  counts: Record<string, number>;
  scores: Record<string, number>;
  total: number;
  done: boolean;
  reveal: { best: string[]; uniq: Record<string, number> } | null;
}

export default function AnagramRace({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { found: string[] }>) {
  const [msg, setMsg] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as any;
    if (ev.type === 'ok') {
      sfx(d.pts >= 7 ? 'win' : 'correct');
      setMsg({ t: `${d.w.toUpperCase()} +${d.pts}`, ok: true, k: Date.now() });
    }
    if (ev.type === 'bad') {
      sfx('wrong');
      setMsg({ t: `${d.w.toUpperCase()}: ${d.why}`, ok: false, k: Date.now() });
    }
  }, false), []);
  const found = priv?.found ?? [];
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(620px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">📝 {found.length} words · {pub.scores[me] ?? 0} pts</span>
        <span className="chip chip-dark">{pub.total} possible</span>
        <SecondsLeft deadline={pub.done ? null : pub.endsAt} />
      </div>
      {pub.done && pub.reveal ? (
        <div className="stack" style={{ alignItems: 'center' }}>
          <Banner title="Time!" sub={`Unique-word bonus: +${pub.reveal.uniq[me] ?? 0}`} />
          <div className="ar-words">{pub.reveal.best.map((w) => <span key={w} className={`chip ${found.includes(w) ? 'chip-green' : ''}`}>{w.toUpperCase()}</span>)}</div>
        </div>
      ) : (
        <>
          <div className="ar-msg">{msg && <span key={msg.k} className={`chip ${msg.ok ? 'chip-green' : 'chip-red'} anim-pop`}>{msg.t}</span>}</div>
          <LetterTiles letters={pub.letters} disabled={!isPlayer} minLength={3} onSubmit={(w) => send({ t: 'word', w })} />
        </>
      )}
      <div className="ar-words mine">
        {[...found].reverse().map((w) => <span key={w} className="chip chip-dark">{w.toUpperCase()}</span>)}
      </div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </Stage>
  );
}
