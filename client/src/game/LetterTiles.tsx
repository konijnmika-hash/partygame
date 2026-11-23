// Tap-or-type letter tile builder used by word games.
import { useEffect, useState } from 'react';
import { useKeys } from './input';
import { sfx } from '../audio/sfx';

export function LetterTiles({ letters, onSubmit, disabled, autoSubmitLength, minLength = 1, resetKey }: {
  letters: string;
  onSubmit: (word: string) => void;
  disabled?: boolean;
  autoSubmitLength?: number;
  minLength?: number;
  resetKey?: unknown;
}) {
  const [order, setOrder] = useState(() => letters.split('').map((_, i) => i));
  const [used, setUsed] = useState<number[]>([]);
  useEffect(() => {
    setOrder(letters.split('').map((_, i) => i));
    setUsed([]);
  }, [letters, resetKey]);
  const word = used.map((i) => letters[i]).join('');
  const submit = (w = word) => {
    if (w.length < minLength || disabled) return;
    onSubmit(w);
    setUsed([]);
  };
  const add = (i: number) => {
    if (disabled || used.includes(i)) return;
    const next = [...used, i];
    setUsed(next);
    sfx('tap', 1 + next.length * 0.05);
    if (autoSubmitLength && next.length === autoSubmitLength) setTimeout(() => submit(next.map((k) => letters[k]).join('')), 120);
  };
  useKeys((k, e) => {
    if (disabled) return;
    if (k === 'Backspace') {
      e.preventDefault();
      setUsed((u) => u.slice(0, -1));
    } else if (k === 'Enter') submit();
    else if (/^[a-zA-Z]$/.test(k)) {
      const idx = order.find((i) => letters[i].toLowerCase() === k.toLowerCase() && !used.includes(i));
      if (idx != null) add(idx);
    }
  }, !disabled);
  return (
    <div className="letter-tiles">
      <div className="lt-word" aria-live="polite">
        {word ? word.split('').map((c, i) => <span key={i} className="lt-slot filled">{c}</span>) : <span className="lt-hint">Tap the letters (or type)</span>}
        {autoSubmitLength && Array.from({ length: Math.max(0, autoSubmitLength - word.length) }, (_, i) => <span key={`e${i}`} className="lt-slot" />)}
      </div>
      <div className="lt-tiles">
        {order.map((i) => (
          <button key={i} className={`lt-tile ${used.includes(i) ? 'used' : ''}`} disabled={disabled || used.includes(i)} onPointerDown={(e) => { e.preventDefault(); add(i); }}>
            {letters[i]}
          </button>
        ))}
      </div>
      <div className="g-row">
        <button className="btn btn-ghost btn-sm" disabled={disabled || !used.length} onClick={() => setUsed((u) => u.slice(0, -1))}>⌫</button>
        <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => { setOrder((o) => [...o].sort(() => Math.random() - 0.5)); sfx('swap'); }}>🔀 Shuffle</button>
        <button className="btn btn-ghost btn-sm" disabled={disabled || !used.length} onClick={() => setUsed([])}>Clear</button>
        {!autoSubmitLength && <button className="btn btn-green" disabled={disabled || word.length < minLength} onClick={() => submit()}>Submit ✓</button>}
      </div>
    </div>
  );
}
