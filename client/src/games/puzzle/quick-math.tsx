import './puzzle.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { MiniScores, NumPad, SecondsLeft, Stage } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  scores: Record<string, number>;
  right: Record<string, number>;
}
interface Priv {
  problem: string;
  idx: number;
  streak: number;
  right: number;
  score: number;
}

export default function QuickMath({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const [flash, setFlash] = useState<{ ok: boolean; ans: number; k: number } | null>(null);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type !== 'answer') return;
    const d = ev.data as { ok: boolean; ans: number };
    setFlash({ ...d, k: Date.now() });
    sfx(d.ok ? 'correct' : 'wrong');
    if (!d.ok) vibrate(80);
  }, false), []);
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(520px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">✅ {priv?.right ?? 0}</span>
        {(priv?.streak ?? 0) >= 2 && <span className="chip chip-yellow">🔥 x{priv!.streak}</span>}
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      <div className={`qm-problem ${flash ? (flash.ok ? 'ok' : 'bad') : ''}`} key={priv?.idx}>
        {priv?.problem ?? '...'} <span className="qm-eq">=</span> <span className="qm-q">?</span>
      </div>
      {flash && !flash.ok && <div className="chip chip-red" key={flash.k}>Answer was {flash.ans}</div>}
      <NumPad disabled={!isPlayer} onSubmit={(v) => send({ t: 'answer', v })} placeholder="answer" />
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
