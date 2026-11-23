import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Avatar as AvatarT } from '@shared/types';
import { avatarSvg, type AvatarRenderOpts } from './avatarSvg';
import { serverNow } from '../net/clock';
import { sfx } from '../audio/sfx';

export function Avatar({ avatar, size = 56, bob, mood, className = '', title }: { avatar: AvatarT; size?: number; bob?: boolean; mood?: AvatarRenderOpts['mood']; className?: string; title?: string }) {
  const html = useMemo(() => avatarSvg(avatar, { mood }), [avatar.color, avatar.eyes, avatar.mouth, avatar.hat, avatar.acc, mood]);
  return <span className={`avatar ${bob ? 'bob' : ''} ${className}`} style={{ width: size, height: size * 1.18 }} title={title} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Logo({ size = 1 }: { size?: number }) {
  return (
    <svg className="logo-svg" viewBox="0 0 440 250" style={{ width: `min(${Math.round(size * 330)}px, 86vw)` }} role="img" aria-label="Bloop Bash">
      <defs>
        <linearGradient id="logo-g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#ffc9e4" />
          <stop offset="1" stopColor="#ff4f9a" />
        </linearGradient>
        <linearGradient id="logo-g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c9" />
          <stop offset="0.5" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <g transform="rotate(-5 220 125)">
        <text x="200" y="112" textAnchor="middle" className="logo-text" fill="#1c0c47" transform="translate(0 11)">Bloop</text>
        <text x="200" y="112" textAnchor="middle" className="logo-text logo-l1" fill="url(#logo-g1)" stroke="#2a1660" strokeWidth="16" strokeLinejoin="round" paintOrder="stroke">Bloop</text>
        <text x="248" y="222" textAnchor="middle" className="logo-text" fill="#1c0c47" transform="translate(0 11)">Bash!</text>
        <text x="248" y="222" textAnchor="middle" className="logo-text logo-l2" fill="url(#logo-g2)" stroke="#2a1660" strokeWidth="16" strokeLinejoin="round" paintOrder="stroke">Bash!</text>
      </g>
    </svg>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <div className="modal card" style={wide ? { width: 'min(860px, 100%)' } : undefined}>
        <div className="modal-head">
          <h2 style={{ color: 'var(--ink)' }}>{title}</h2>
          <button className="btn btn-white btn-icon btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Animated number that counts up to `value`. */
export function CountUp({ value, duration = 900, prefix = '', className = '' }: { value: number; duration?: number; prefix?: string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{prefix}{shown.toLocaleString()}</span>;
}

/** Re-render on an interval (for countdowns). */
export function useNow(intervalMs = 200): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Seconds remaining until a server timestamp. */
export function useSecondsLeft(deadline: number | null | undefined, tickSound = false): number {
  const now = useNow(100);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const prev = useRef(left);
  useEffect(() => {
    if (tickSound && left !== prev.current && left > 0 && left <= 5) sfx(left <= 3 ? 'countdown' : 'tick');
    prev.current = left;
  }, [left, tickSound]);
  return left;
}

export function TimerBar({ deadline, total, className = '' }: { deadline: number | null | undefined; total: number; className?: string }) {
  const now = useNow(100);
  const left = deadline ? Math.max(0, deadline - now) : 0;
  const pct = total > 0 ? Math.min(100, (left / total) * 100) : 0;
  const hot = left < 5000;
  return (
    <div className={`timer-bar ${hot ? 'hot' : ''} ${className}`} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TimerPill({ deadline, sound = true }: { deadline: number | null | undefined; sound?: boolean }) {
  const s = useSecondsLeft(deadline, sound);
  if (!deadline) return null;
  return <span className={`timer-pill ${s <= 5 ? 'hot' : ''}`}>⏱ {s}s</span>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => { sfx('select'); onChange(e.target.checked); }} />
      <span className="knob" />
      <span>{label}</span>
    </label>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.v)}
          className={o.v === value ? 'on' : ''}
          disabled={disabled}
          role="radio"
          aria-checked={o.v === value}
          onClick={() => {
            sfx('select');
            onChange(o.v);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LevelBadge({ level }: { level: number }) {
  return <span className="badge-level" title={`Level ${level}`}>{level}</span>;
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Rank({ rank }: { rank: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return <span className={`rank rank-${Math.min(rank, 4)}`}>{medal ?? `#${rank}`}</span>;
}
