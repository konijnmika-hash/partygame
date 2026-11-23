import './memory.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, NumPad, PlayerStrip, SecondsLeft, Stage } from './_shared';
import { sfx } from '../../audio/sfx';

interface Pub {
  endsAt: number;
  p: Record<string, { best: number; lives: number; out: boolean }>;
}
interface Priv {
  phase: 'show' | 'input' | 'feedback' | 'out';
  len: number;
  lives: number;
  digits: string | null;
  last: { ok: boolean; was: string } | null;
  best: number;
}

export default function FlashMemory({ pub, priv, isPlayer, send, players }: GameViewProps<Pub, Priv>) {
  useEffect(() => {
    if (priv?.phase === 'show') sfx('blip');
    if (priv?.phase === 'feedback' && priv.last) sfx(priv.last.ok ? 'correct' : 'wrong');
  }, [priv?.phase, priv?.len, priv?.lives]);
  if (!priv) return <Stage className="centered"><Banner title="Watching..." /></Stage>;
  return (
    <Stage>
      <div className="g-row" style={{ width: 'min(520px,100%)', justifyContent: 'space-between' }}>
        <span className="chip chip-dark">{priv.len} digits</span>
        <span className="chip chip-dark">{'❤️'.repeat(Math.max(0, priv.lives))}</span>
        <SecondsLeft deadline={pub.endsAt} />
      </div>
      <div className="fm-display">
        {priv.phase === 'show' && <span className="fm-digits anim-pop">{priv.digits}</span>}
        {priv.phase === 'input' && <span className="fm-q">Type the number!</span>}
        {(priv.phase === 'feedback' || priv.phase === 'out') && priv.last && (
          <span className={`fm-fb ${priv.last.ok ? 'ok' : 'bad'}`}>{priv.last.ok ? 'Correct! 🎉' : <>It was <b>{priv.last.was}</b></>}</span>
        )}
      </div>
      {priv.phase === 'out' ? (
        <Banner title={`Out! Best: ${priv.best} digits`} tone="bad" />
      ) : (
        <NumPad maxLen={20} disabled={!isPlayer || priv.phase !== 'input'} onSubmit={(_v, raw) => send({ t: 'answer', v: raw })} placeholder={'•'.repeat(priv.len)} />
      )}
      <PlayerStrip players={players} ids={Object.keys(pub.p)} size={30} dim={(id) => pub.p[id].out} badge={(id) => `${pub.p[id].best}`} />
    </Stage>
  );
}
