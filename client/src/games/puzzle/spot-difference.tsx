import './puzzle.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Countdown, MiniScores, RoundDots, Stage, useRafNow } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Cell {
  e: string | null;
  t: number;
  f: 0 | 1;
  s: 0 | 1;
}
interface Pub {
  scene: number;
  n: number;
  cols: number;
  left: Cell[];
  right: Cell[];
  deadline: number;
  phase: 'find' | 'reveal';
  counts: Record<string, number>;
  diffs: number[] | null;
  total: number;
  scores: Record<string, number>;
}

const TINTS = ['#ffe4ec', '#e4f1ff', '#e6ffe9', '#fff6d6', '#efe6ff', '#ffeede'];

function Scene({ cells, cols, onTap, marks, reveal, label }: { cells: Cell[]; cols: number; onTap?: (i: number) => void; marks?: number[]; reveal?: number[] | null; label: string }) {
  return (
    <div className="sd-scene" aria-label={label}>
      <div className="sd-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cells.map((c, i) => (
          <button key={i} className={`sd-cell ${marks?.includes(i) ? 'found' : ''} ${reveal?.includes(i) && !marks?.includes(i) ? 'missed' : ''}`} style={{ background: TINTS[c.t] }} disabled={!onTap} onPointerDown={(e) => { e.preventDefault(); onTap?.(i); }}>
            <span style={{ transform: `${c.f ? 'scaleX(-1)' : ''} ${c.s ? 'scale(1.45)' : ''}` }}>{c.e ?? ''}</span>
          </button>
        ))}
      </div>
      <span className="sd-label">{label}</span>
    </div>
  );
}

export default function SpotDifference({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { found: number[]; frozenUntil: number }>) {
  const now = useRafNow();
  const found = priv?.found ?? [];
  useEffect(() => {
    if (found.length) sfx('correct');
  }, [found.length]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'wrong') {
      sfx('buzz');
      vibrate(90);
    }
  }, false), []);
  const frozen = (priv?.frozenUntil ?? 0) > now;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.scene} />
      <Countdown deadline={pub.phase === 'find' ? pub.deadline : null} total={40000} />
      <div className="g-row">
        <span className="chip chip-dark">Found {found.length}/{pub.total}</span>
        {frozen && <span className="chip chip-red">❄️ Wrong spot!</span>}
      </div>
      <div className={`sd-wrap ${frozen ? 'frozen' : ''}`}>
        <Scene cells={pub.left} cols={pub.cols} label="Original" />
        <Scene cells={pub.right} cols={pub.cols} label="Tap the differences here" onTap={isPlayer && pub.phase === 'find' && !frozen ? (i) => send({ t: 'tap', i }) : undefined} marks={found} reveal={pub.diffs} />
      </div>
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </Stage>
  );
}
