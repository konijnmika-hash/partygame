import './drawing.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, Countdown, MiniScores } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { DoneBar } from '../social/_kit';
import { sfx } from '../../audio/sfx';

const COLORS = ['transparent', '#1d1442', '#ff4f5f', '#ffd23f', '#34cf78', '#3da9fc', '#ff8a3d'];

interface Pub {
  phase: 'paint' | 'guess' | 'reveal';
  deadline: number;
  size: number;
  painted: string[];
  artist: string | null;
  qi: number;
  qn: number;
  grid: number[] | null;
  options: string[] | null;
  picked: string[];
  reveal: { answer: number; picks: Record<string, number> } | null;
  scores: Record<string, number>;
}

function PixelGrid({ grid, size, onPaint }: { grid: number[]; size: number; onPaint?: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const painting = useRef(false);
  const cellAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * size);
    const rr = Math.floor(((e.clientY - r.top) / r.height) * size);
    if (c < 0 || rr < 0 || c >= size || rr >= size) return -1;
    return rr * size + c;
  };
  return (
    <div
      ref={ref}
      className={`px-grid ${onPaint ? 'editable' : ''}`}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      onPointerDown={(e) => {
        if (!onPaint) return;
        painting.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        const i = cellAt(e);
        if (i >= 0) onPaint(i);
      }}
      onPointerMove={(e) => {
        if (!onPaint || !painting.current) return;
        const i = cellAt(e);
        if (i >= 0) onPaint(i);
      }}
      onPointerUp={() => (painting.current = false)}
      onPointerCancel={() => (painting.current = false)}
    >
      {grid.map((c, i) => <span key={i} className="px" style={{ background: COLORS[c] ?? 'transparent' }} />)}
    </div>
  );
}

export default function PixelGuess({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { word: string; grid: number[] | null; myPick: number | null }>) {
  const [color, setColor] = useState(1);
  const [local, setLocal] = useState<number[]>(() => new Array(100).fill(0));
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (priv?.grid && local.every((v) => v === 0)) setLocal(priv.grid);
  }, [!!priv?.grid]);
  useEffect(() => {
    if (pub.phase === 'reveal' && pub.reveal && priv?.myPick != null) sfx(priv.myPick === pub.reveal.answer ? 'correct' : 'wrong');
  }, [pub.phase, pub.qi]);
  const paint = (i: number) => {
    if (local[i] === color) return;
    const next = [...local];
    next[i] = color;
    setLocal(next);
    sfx('tap', 1.2);
    send({ t: 'px', i, c: color });
  };
  if (pub.phase === 'paint') {
    return (
      <div className="g-stage">
        <Banner title={<>Paint: <span className="hl-word">{priv?.word}</span></>} sub="Use the tiny grid — others will guess it!" />
        <Countdown deadline={pub.deadline} total={45000} />
        <PixelGrid grid={local} size={pub.size} onPaint={isPlayer && !done ? paint : undefined} />
        <div className="palette">
          {COLORS.map((c, i) => (
            <button key={i} className={`swatch ${i === color ? 'on' : ''} ${i === 0 ? 'eraser' : ''}`} style={{ background: i === 0 ? '#fff' : c }} onClick={() => setColor(i)} aria-label={i === 0 ? 'Eraser' : `Colour ${i}`}>{i === 0 ? '⌫' : ''}</button>
          ))}
        </div>
        {isPlayer && (done ? <Banner title="Done! 🎨" sub="Waiting for the other artists..." /> : <button className="btn btn-green" onClick={() => { setDone(true); send({ t: 'done' }); }}>Done painting</button>)}
        <DoneBar players={players} ids={Object.keys(pub.scores)} done={pub.painted} label="Finished" />
      </div>
    );
  }
  const artist = player(pub.artist ?? '');
  const mineArt = pub.artist === me;
  return (
    <div className="g-stage">
      <div className="row-nw">
        {artist && <Avatar avatar={artist.avatar} size={36} />}
        <b>{mineArt ? 'Your masterpiece!' : `${artist?.name}'s painting`}</b>
        <span className="chip chip-dark">{pub.qi + 1}/{pub.qn}</span>
      </div>
      <Countdown deadline={pub.phase === 'guess' ? pub.deadline : null} total={13000} />
      {pub.grid && <PixelGrid grid={pub.grid} size={pub.size} />}
      {pub.options && (
        <ChoiceGrid
          compact
          cols={3}
          choices={pub.options.map((o) => ({ label: o }))}
          picked={priv?.myPick ?? null}
          correct={pub.reveal ? pub.reveal.answer : null}
          wrong={pub.reveal && priv?.myPick != null && priv.myPick !== pub.reveal.answer ? [priv.myPick] : []}
          disabled={!isPlayer || mineArt || priv?.myPick != null || pub.phase !== 'guess'}
          onPick={(c) => send({ t: 'pick', c })}
        />
      )}
      {mineArt && pub.phase === 'guess' && <Banner title="Can they tell what it is? 🤞" />}
      <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
    </div>
  );
}
