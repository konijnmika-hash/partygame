import './memory.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, PlayerStrip, SecondsLeft, Stage } from './_shared';
import { subscribeGameEvents, useStore } from '../../state/store';
import { midi, sfx, tone, vibrate } from '../../audio/sfx';
import { updateSettings } from '../../boot';

interface Pub {
  endsAt: number;
  boards: number;
  progress: Record<string, { board: number; matched: number }>;
}
interface Priv {
  board: number;
  count: number;
  matched: number[];
  first: number | null;
  penalty: number;
  times: number[];
}

/** Original synthesized motifs, one per sound id. */
export function playMotif(id: string): void {
  switch (id) {
    case 'up': [60, 64, 67].forEach((n, i) => tone(midi(n + 12), 0.12, { type: 'square', vol: 0.12, when: i * 0.1, filter: 3000 })); break;
    case 'down': [67, 64, 60].forEach((n, i) => tone(midi(n + 12), 0.12, { type: 'square', vol: 0.12, when: i * 0.1, filter: 3000 })); break;
    case 'zap': tone(1400, 0.3, { type: 'sawtooth', vol: 0.12, slideTo: 180, filter: 4000 }); break;
    case 'boing': tone(180, 0.18, { type: 'sine', vol: 0.35, slideTo: 620 }); tone(620, 0.22, { type: 'sine', vol: 0.3, slideTo: 300, when: 0.18 }); break;
    case 'chime': tone(midi(81), 0.6, { type: 'triangle', vol: 0.2, release: 0.5 }); tone(midi(88), 0.6, { type: 'sine', vol: 0.1, when: 0.05, release: 0.5 }); break;
    case 'buzz': tone(110, 0.4, { type: 'square', vol: 0.12, filter: 900 }); break;
    case 'trill': [76, 77, 76, 77, 76, 77].forEach((n, i) => tone(midi(n), 0.07, { type: 'triangle', vol: 0.2, when: i * 0.07 })); break;
    case 'bass': [36, 36, 31].forEach((n, i) => tone(midi(n), 0.18, { type: 'sawtooth', vol: 0.25, when: i * 0.2, filter: 600 })); break;
    case 'bell': tone(880, 0.9, { type: 'sine', vol: 0.25, release: 0.85 }); tone(1760 * 1.01, 0.6, { type: 'sine', vol: 0.06, release: 0.5 }); break;
    case 'siren': tone(600, 0.3, { type: 'triangle', vol: 0.2, slideTo: 950 }); tone(950, 0.3, { type: 'triangle', vol: 0.2, slideTo: 600, when: 0.3 }); break;
    case 'drop': tone(1000, 0.25, { type: 'sine', vol: 0.3, slideTo: 90 }); break;
    case 'chirp': tone(2200, 0.06, { type: 'sine', vol: 0.15, slideTo: 3200 }); tone(2200, 0.06, { type: 'sine', vol: 0.15, slideTo: 3200, when: 0.12 }); break;
  }
}

export default function SoundMemory({ pub, priv, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  const muted = useStore((s) => s.settings.sfxMuted);
  const [miss, setMiss] = useState<number[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as any;
    if (ev.type === 'play') {
      playMotif(d.s);
      setPlaying(d.i);
      setTimeout(() => setPlaying((p) => (p === d.i ? null : p)), 600);
    }
    if (ev.type === 'match') setTimeout(() => sfx('correct'), 450);
    if (ev.type === 'miss') {
      vibrate(50);
      setMiss([d.i, d.j]);
      setTimeout(() => setMiss([]), 700);
    }
  }, false), []);
  if (!priv) return <Stage className="centered"><Banner title="Watching..." /></Stage>;
  const done = priv.board >= pub.boards;
  const cols = priv.count <= 12 ? 4 : 4;
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(560px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">Board {Math.min(pub.boards, priv.board + 1)}/{pub.boards}</span>
        {priv.penalty > 0 && <span className="chip chip-red">+{(priv.penalty / 1000).toFixed(0)}s penalty</span>}
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      {muted && <div className="intro-warn">🔇 Sound is off! <button className="btn btn-yellow btn-sm" onClick={() => updateSettings({ sfxMuted: false })}>Turn on</button></div>}
      {done ? (
        <Banner title="Perfect ears! 🎧" sub={`${(priv.times.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s total`} tone="good" big />
      ) : (
        <>
          <Banner title="Find matching sounds" sub="Tap a card to hear it" />
          <div className="board mt-board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${Math.ceil(priv.count / cols)}` }}>
            {Array.from({ length: priv.count }, (_, i) => {
              const matched = priv.matched.includes(i);
              return (
                <button key={`${priv.board}-${i}`} className={`mt-card sound ${matched ? 'up matched' : ''} ${priv.first === i || playing === i ? 'playing' : ''} ${miss.includes(i) ? 'miss' : ''}`} disabled={!isPlayer || matched} onPointerDown={(e) => { e.preventDefault(); send({ t: 'flip', i }); }}>
                  <span className="mt-inner">{matched ? '✅' : playing === i ? '🔊' : '🎵'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <PlayerStrip players={players} ids={Object.keys(pub.progress)} size={30} badge={(id) => `${pub.progress[id].board}/${pub.boards}`} />
    </Stage>
  );
}
