import './memory.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, PlayerStrip, SecondsLeft, Stage } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  levels: Record<string, { level: number; lives: number; out: boolean }>;
}
interface Priv {
  level: number;
  lives: number;
  phase: 'show' | 'input' | 'out' | 'feedback';
  size: number;
  lit: number[] | null;
  need: number;
}

export default function PatternMemory({ pub, priv, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const [sel, setSel] = useState<number[]>([]);
  const [fb, setFb] = useState<{ ok: boolean; answer: number[] } | null>(null);
  useEffect(() => {
    setSel([]);
    if (priv?.phase === 'show') {
      setFb(null);
      sfx('blip');
    }
  }, [priv?.phase, priv?.level]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type !== 'result') return;
    const d = ev.data as { ok: boolean; answer: number[] };
    setFb(d);
    sfx(d.ok ? 'correct' : 'wrong');
  }, false), []);
  if (!priv) return <Stage className="centered"><Banner title="Watching..." /></Stage>;
  const toggle = (i: number) => {
    if (!isPlayer || priv.phase !== 'input') return;
    const next = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i];
    sfx('tap', 1 + next.length * 0.05);
    setSel(next);
    if (next.length === priv.need) send({ t: 'submit', cells: next });
  };
  const n = priv.size * priv.size;
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(520px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">Level {priv.level + 1}</span>
        <span className="chip chip-dark">{'❤️'.repeat(Math.max(0, priv.lives))}{'🖤'.repeat(Math.max(0, 3 - priv.lives))}</span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      <Banner title={priv.phase === 'show' ? 'Memorize!' : priv.phase === 'input' ? `Tap ${priv.need - sel.length} more` : priv.phase === 'out' ? 'Out of lives!' : fb?.ok ? 'Correct! 🎉' : 'Oops! ❌'} tone={priv.phase === 'feedback' ? (fb?.ok ? 'good' : 'bad') : 'default'} />
      <div className="board pm-board" style={{ gridTemplateColumns: `repeat(${priv.size}, 1fr)` }}>
        {Array.from({ length: n }, (_, i) => {
          const lit = priv.lit?.includes(i);
          const picked = sel.includes(i);
          const answer = priv.phase === 'feedback' && fb && !fb.ok && fb.answer.includes(i);
          return <button key={i} className={`cell ${lit ? 'lit' : ''} ${picked ? 'on' : ''} ${answer ? 'good' : ''}`} disabled={!isPlayer || priv.phase !== 'input'} onPointerDown={(e) => { e.preventDefault(); toggle(i); }} />;
        })}
      </div>
      <PlayerStrip players={players} ids={Object.keys(pub.levels)} size={30} dim={(id) => pub.levels[id].out} badge={(id) => `Lv ${pub.levels[id].level + 1}`} />
    </Stage>
  );
}
