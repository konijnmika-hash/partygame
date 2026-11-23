import './memory.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, PlayerStrip, Stage, useKeys, useRafNow } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { midi, sfx, tone } from '../../audio/sfx';

interface Pub {
  len: number;
  phase: 'show' | 'input' | 'result';
  show: number[] | null;
  showStart: number;
  stepMs: number;
  inputUntil: number;
  alive: string[];
  done: string[];
  outAt: Record<string, number>;
}

const PADS = [
  { hex: '#ff4f5f', note: 60 },
  { hex: '#3da9fc', note: 64 },
  { hex: '#34cf78', note: 67 },
  { hex: '#ffd23f', note: 72 },
];

export default function SequenceChallenge({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { progress: number }>) {
  const now = useRafNow();
  const [press, setPress] = useState<number | null>(null);
  const played = useRef(-1);
  const alive = pub.alive.includes(me);
  const can = isPlayer && alive && pub.phase === 'input' && !pub.done.includes(me);
  // which pad is lit during the show
  let lit: number | null = null;
  if (pub.phase === 'show' && pub.show) {
    const k = Math.floor((now - pub.showStart) / pub.stepMs);
    const within = (now - pub.showStart) % pub.stepMs < pub.stepMs * 0.72;
    if (k >= 0 && k < pub.show.length && within) lit = pub.show[k];
    if (k >= 0 && k < pub.show.length && k !== played.current && within) {
      played.current = k;
      tone(midi(PADS[pub.show[k]].note), Math.min(0.5, pub.stepMs / 1000 * 0.7), { type: 'triangle', vol: 0.3 });
    }
  }
  useEffect(() => {
    played.current = -1;
  }, [pub.len, pub.phase]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'out') sfx('lose');
  }, false), []);
  const hit = (p: number) => {
    if (!can) return;
    tone(midi(PADS[p].note), 0.25, { type: 'triangle', vol: 0.3 });
    setPress(p);
    setTimeout(() => setPress(null), 160);
    send({ t: 'pad', p });
  };
  useKeys((k) => {
    const n = Number(k);
    if (n >= 1 && n <= 4) hit(n - 1);
  }, can);
  return (
    <Stage>
      <Banner
        title={!alive ? `Out at ${pub.outAt[me] ?? 0} steps` : pub.phase === 'show' ? 'Watch & listen...' : pub.phase === 'input' ? (pub.done.includes(me) ? 'Nailed it! ✅' : `Your turn: ${priv?.progress ?? 0}/${pub.len}`) : 'Next round...'}
        sub={`Sequence length: ${pub.len}`}
        tone={!alive ? 'bad' : pub.done.includes(me) ? 'good' : 'default'}
      />
      <div className="seq-pads">
        {PADS.map((p, i) => (
          <button key={i} className={`seq-pad ${lit === i || press === i ? 'lit' : ''}`} style={{ ['--pc' as any]: p.hex }} disabled={!can} onPointerDown={(e) => { e.preventDefault(); hit(i); }} aria-label={`Pad ${i + 1}`}>
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      <PlayerStrip players={players} ids={[...new Set([...pub.alive, ...Object.keys(pub.outAt)])]} size={30} dim={(id) => !pub.alive.includes(id)} highlight={(id) => pub.done.includes(id)} badge={(id) => (pub.alive.includes(id) ? (pub.done.includes(id) ? '✓' : '') : `${pub.outAt[id]}`)} />
    </Stage>
  );
}
