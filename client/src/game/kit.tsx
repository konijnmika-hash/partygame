// Reusable building blocks for minigame views.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomMember } from '@shared/types';
import { Avatar, TimerBar, useSecondsLeft } from '../components/ui';
import { sfx, vibrate } from '../audio/sfx';
import { useKeys } from './input';
import { serverNow as serverNowFn } from '../net/clock';

export function Stage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`g-stage ${className}`}>{children}</div>;
}

export function Banner({ title, sub, tone = 'default', big }: { title: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' | 'info'; big?: boolean }) {
  return (
    <div className={`g-banner tone-${tone} ${big ? 'big' : ''}`}>
      <div className="g-banner-title">{title}</div>
      {sub != null && <div className="g-banner-sub">{sub}</div>}
    </div>
  );
}

export function Countdown({ deadline, total }: { deadline: number | null | undefined; total: number }) {
  if (!deadline) return null;
  return <TimerBar deadline={deadline} total={total} className="g-timer" />;
}

export function SecondsLeft({ deadline }: { deadline: number | null | undefined }) {
  const s = useSecondsLeft(deadline, true);
  if (!deadline) return null;
  return <span className={`g-secs ${s <= 5 ? 'hot' : ''}`}>{s}</span>;
}

export interface Choice {
  label: ReactNode;
  sub?: ReactNode;
  color?: string;
  disabled?: boolean;
}

/** Length of the longest word, used to shrink labels that would otherwise break mid-word. */
function longestWord(s: string): number {
  let m = 1;
  for (const w of s.split(/\s+/)) m = Math.max(m, w.length);
  return m;
}

/** Big tappable answer buttons. Number keys 1-9 select. */
export function ChoiceGrid({ choices, onPick, picked, correct, wrong, disabled, cols, keyboard = true, compact }: {
  choices: Choice[];
  onPick: (i: number) => void;
  picked?: number | null;
  correct?: number | null;
  wrong?: number[];
  disabled?: boolean;
  cols?: number;
  keyboard?: boolean;
  compact?: boolean;
}) {
  useKeys((k) => {
    const n = Number(k);
    if (!disabled && n >= 1 && n <= choices.length && !choices[n - 1].disabled) {
      sfx('tap');
      onPick(n - 1);
    }
  }, keyboard && !disabled);
  const c = cols ?? (choices.length <= 2 ? 2 : choices.length === 3 ? 3 : choices.length <= 4 ? 2 : choices.length <= 6 ? 3 : 4);
  return (
    <div className={`choice-grid ${compact ? 'compact' : ''}`} style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }}>
      {choices.map((ch, i) => {
        const state = correct === i ? 'correct' : wrong?.includes(i) ? 'wrong' : picked === i ? 'picked' : '';
        return (
          <button
            key={i}
            className={`choice ${state}`}
            style={ch.color ? ({ ['--cc' as any]: ch.color } as any) : undefined}
            disabled={disabled || ch.disabled}
            onClick={() => {
              sfx('tap');
              vibrate(10);
              onPick(i);
            }}
          >
            <span className="choice-key">{i + 1}</span>
            <span className="choice-label" style={typeof ch.label === 'string' ? ({ ['--chars' as any]: longestWord(ch.label) } as any) : undefined}>{ch.label}</span>
            {ch.sub != null && <span className="choice-sub">{ch.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Row of small player avatars with an optional badge per player. */
export function PlayerStrip({ players, ids, badge, highlight, dim, size = 40, onPick, pickable }: {
  players: RoomMember[];
  ids?: string[];
  badge?: (id: string) => ReactNode;
  highlight?: (id: string) => boolean;
  dim?: (id: string) => boolean;
  size?: number;
  onPick?: (id: string) => void;
  pickable?: (id: string) => boolean;
}) {
  const list = ids ? ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as RoomMember[] : players;
  return (
    <div className="player-strip">
      {list.map((p) => {
        const can = onPick && (!pickable || pickable(p.id));
        return (
          <button
            key={p.id}
            className={`ps-item ${highlight?.(p.id) ? 'hi' : ''} ${dim?.(p.id) ? 'dim' : ''} ${can ? 'can' : ''}`}
            disabled={!can}
            onClick={() => {
              if (!can) return;
              sfx('tap');
              onPick!(p.id);
            }}
          >
            <Avatar avatar={p.avatar} size={size} />
            <span className="ps-name">{p.name}</span>
            {badge && <span className="ps-badge">{badge(p.id)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Waiting({ text = 'Waiting for the others...' }: { text?: string }) {
  return (
    <div className="g-waiting">
      <span className="dots"><i /><i /><i /></span>
      <span>{text}</span>
    </div>
  );
}

/** Mini scoreboard inside a game. */
export function MiniScores({ players, scores, me, fmt = (v) => String(v), limit = 8, title }: {
  players: RoomMember[];
  scores: Record<string, number>;
  me: string;
  fmt?: (v: number) => string;
  limit?: number;
  title?: string;
}) {
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, limit);
  return (
    <div className="mini-scores">
      {title && <div className="ms-title">{title}</div>}
      {rows.map(([id, v], i) => {
        const p = players.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div key={id} className={`ms-row ${id === me ? 'me' : ''}`}>
            <span className="ms-rank">{i + 1}</span>
            <Avatar avatar={p.avatar} size={24} />
            <span className="ms-name">{p.name}</span>
            <span className="ms-val">{fmt(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact "#2 of 5" pill for small screens where a full score list would cover the game. */
export function RankPill({ scores, me, fmt = (v) => String(v) }: { scores: Record<string, number>; me: string; fmt?: (v: number) => string }) {
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const i = rows.findIndex(([id]) => id === me);
  if (i < 0) return null;
  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
  return (
    <span className="rank-pill">
      {medal} #{i + 1}/{rows.length} · {fmt(rows[i][1])}
    </span>
  );
}

/** On-screen number pad (with keyboard support). */
export function NumPad({ onSubmit, maxLen = 6, allowNegative, disabled, placeholder = '?', autoClear = true }: {
  onSubmit: (v: number, raw: string) => void;
  maxLen?: number;
  allowNegative?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoClear?: boolean;
}) {
  const [v, setV] = useState('');
  const submit = () => {
    if (!v || v === '-') return;
    onSubmit(Number(v), v);
    if (autoClear) setV('');
  };
  const press = (k: string) => {
    if (disabled) return;
    sfx('tap');
    if (k === '⌫') setV((s) => s.slice(0, -1));
    else if (k === '±') setV((s) => (s.startsWith('-') ? s.slice(1) : '-' + s));
    else if (k === '✓') submit();
    else setV((s) => (s.replace('-', '').length >= maxLen ? s : s + k));
  };
  useKeys((k) => {
    if (/^[0-9]$/.test(k)) press(k);
    else if (k === 'Backspace') press('⌫');
    else if (k === 'Enter') press('✓');
    else if (k === '-' && allowNegative) press('±');
  }, !disabled);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowNegative ? '±' : '⌫', '0', '✓'];
  return (
    <div className="numpad">
      <div className="np-display">{v || <span className="muted">{placeholder}</span>}{allowNegative && <button className="np-back" onClick={() => press('⌫')}>⌫</button>}</div>
      <div className="np-keys">
        {keys.map((k) => (
          <button key={k} className={`np-key ${k === '✓' ? 'ok' : ''}`} disabled={disabled} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Text entry with submit button; keeps focus for rapid entries. */
export function TextEntry({ onSubmit, placeholder, maxLength = 40, disabled, button = 'Send', autoFocus = true, clearOnSubmit = true, initial = '' }: {
  onSubmit: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  button?: ReactNode;
  autoFocus?: boolean;
  clearOnSubmit?: boolean;
  initial?: string;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !disabled && window.matchMedia('(pointer: fine)').matches) ref.current?.focus();
  }, [disabled]);
  return (
    <form
      className="text-entry"
      onSubmit={(e) => {
        e.preventDefault();
        const t = v.trim();
        if (!t || disabled) return;
        onSubmit(t);
        sfx('pop');
        if (clearOnSubmit) setV('');
      }}
    >
      <input
        ref={ref}
        className="input"
        value={v}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
      />
      <button className="btn btn-pink" type="submit" disabled={disabled || !v.trim()}>
        {button}
      </button>
    </form>
  );
}

/** Full-area tap target (reaction games). Reports tap with the time since `armedAt`. */
export function TapZone({ onTap, children, className = '', disabled, style }: { onTap: (e: React.PointerEvent) => void; children?: ReactNode; className?: string; disabled?: boolean; style?: React.CSSProperties }) {
  useKeys((k, e) => {
    if (disabled) return;
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      onTap({} as React.PointerEvent);
    }
  }, !disabled);
  return (
    <div
      className={`tap-zone ${className} ${disabled ? 'disabled' : ''}`}
      style={style}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        vibrate(15);
        onTap(e);
      }}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

/** Tracks when a value last changed (performance.now) — used for client reaction timing. */
export function useChangedAt(value: unknown): React.MutableRefObject<number> {
  const at = useRef(performance.now());
  const prev = useRef(value);
  if (prev.current !== value) {
    prev.current = value;
    at.current = performance.now();
  }
  return at;
}

export function RoundDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="round-dots" aria-label={`Round ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < current ? 'done' : i === current ? 'now' : ''} />
      ))}
    </div>
  );
}

export function nameOf(players: RoomMember[], id: string | null | undefined): string {
  if (!id) return '???';
  return players.find((p) => p.id === id)?.name ?? '???';
}

export function Big({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`g-big ${className}`}>{children}</div>;
}

/** Plays a sound when `value` changes (and passes `when`). */
export function useSfxOn(value: unknown, name: Parameters<typeof sfx>[0], when = true): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (when) sfx(name);
  }, [value]);
}

/** Server-synced time updated every animation frame (for needles, timers, motion). */
export function useRafNow(): number {
  const [t, setT] = useState(() => serverNowSafe());
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setT(serverNowSafe());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

function serverNowSafe(): number {
  return serverNowFn();
}

/** 4-way direction pad for touch (also mirrors arrow keys). */
export function DPad({ onDir, disabled }: { onDir: (d: 'up' | 'down' | 'left' | 'right') => void; disabled?: boolean }) {
  useKeys((k, e) => {
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const d = map[k];
    if (d && !disabled) {
      e.preventDefault();
      onDir(d);
    }
  }, !disabled);
  const b = (d: 'up' | 'down' | 'left' | 'right', label: string) => (
    <button className={`dpad-btn dp-${d}`} disabled={disabled} onPointerDown={(e) => { e.preventDefault(); vibrate(8); onDir(d); }} aria-label={d}>{label}</button>
  );
  return (
    <div className="dpad">
      {b('up', '▲')}
      {b('left', '◀')}
      {b('right', '▶')}
      {b('down', '▼')}
    </div>
  );
}

/** True while the viewport is taller than wide (phones held upright). */
export function usePortrait(): boolean {
  const get = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.1;
  const [p, setP] = useState(get);
  useEffect(() => {
    const on = () => setP(get());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return p;
}

/** Swipe detection on an element: calls back with a direction. */
export function useSwipe(onSwipe: (d: 'up' | 'down' | 'left' | 'right') => void, minDist = 28) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < minDist) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
  };
}
export { useKeys } from './input';
