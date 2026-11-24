import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SVGProps } from 'react';
import { create } from 'zustand';

/* ---------- Icons (24px stroke) ---------- */
const S = (props: SVGProps<SVGSVGElement>) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props} />
);
export const I = {
  plus: () => <S><path d="M12 5v14M5 12h14" /></S>,
  minus: () => <S><path d="M5 12h14" /></S>,
  close: () => <S><path d="M6 6l12 12M18 6L6 18" /></S>,
  left: () => <S><path d="M15 18l-6-6 6-6" /></S>,
  right: () => <S><path d="M9 18l6-6-6-6" /></S>,
  search: () => <S><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></S>,
  check: () => <S><path d="M5 12.5l4.5 4.5L19 7.5" /></S>,
  heart: ({ filled }: { filled?: boolean }) => <S fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></S>,
  barcode: () => <S><path d="M4 6v12M7 6v12M11 6v12M14 6v12M17 6v12M20 6v12" /></S>,
  bolt: () => <S><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" /></S>,
  pencil: () => <S><path d="M4 20h4L19 9l-4-4L4 16v4z" /></S>,
  trash: () => <S><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></S>,
  lock: () => <S><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></S>,
  today: () => <S><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M9 14.5l2 2 4-4" /></S>,
  dumbbell: () => <S><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" /></S>,
  chart: () => <S><path d="M4 19h16M7 15l4-5 3 3 5-7" /></S>,
  user: () => <S><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></S>,
  drop: () => <S><path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" /></S>,
  shoe: () => <S><path d="M3 17h18v-2c0-1.5-1-2.5-3-3l-4-1-2-4H9l-1 3-3-.5L3 12v5z" /><path d="M3 20h18" /></S>,
  flame: () => <S><path d="M12 21c4 0 7-2.7 7-6.5 0-4-3-6-4-9.5-1.5 2-2 3.5-2 5-1-1-2-2.3-2-4C7.5 8 5 11 5 14.5 5 18.3 8 21 12 21z" /></S>,
  scale: () => <S><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M9 9.5a4 4 0 016 0L12 12" /></S>,
  link: () => <S><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></S>,
  star: () => <S><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z" /></S>,
  info: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></S>,
  bell: () => <S><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 004 0" /></S>,
  timer: () => <S><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></S>,
  copy: () => <S><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></S>,
  sunrise: () => <S><path d="M3 18h18M6 18a6 6 0 0112 0M12 4v3M4.9 9.9l1.4 1.4M19.1 9.9l-1.4 1.4" /></S>,
  sun: () => <S><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>,
  moon: () => <S><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></S>,
  apple: () => <S><path d="M12 7c-1.5-1-5-1.5-6.5 1.5S5 16 7 19c1.2 1.8 2.7 2 5 1 2.3 1 3.8.8 5-1 2-3 2.5-7.5 1.5-10.5S13.5 6 12 7z" /><path d="M12 7c0-2 1-3.5 3-4" /></S>,
};

/** Puls-logo: een hartslaglijn die eindigt in een opgaande pijl. */
export function Logo({ size = 30, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="10" fill={light ? '#e9fbd9' : 'var(--brand)'} />
      <path d="M5 17.5h5l2.6-6 4.2 11 3.2-8.5 1.6 3.5H27" fill="none" stroke={light ? '#0f3a26' : '#c9f27a'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export const LogoMark = Logo;

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="brand" style={light ? { color: '#f2fbf5' } : undefined}>
      <Logo size={32} light={light} />
      puls
    </div>
  );
}

/* ---------- Progress ring ---------- */
export function Ring({
  size, stroke, value, color, track = 'color-mix(in srgb, var(--ink) 9%, transparent)', children, dot = false,
}: { size: number; stroke: number; value: number; color: string; track?: string; children?: ReactNode; dot?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const angle = v * 2 * Math.PI - Math.PI / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.2,.8,.2,1)' }}
        />
        {dot && v > 0.02 && (
          <circle
            cx={size / 2 + r * Math.cos(angle)} cy={size / 2 + r * Math.sin(angle)} r={stroke * 0.85}
            fill="#ffd35c" stroke="var(--surface)" strokeWidth={3}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

export function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

/* ---------- Sheet ---------- */
export function Sheet({ children, onClose, full = false, title, right }: { children: ReactNode; onClose: () => void; full?: boolean; title?: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={'sheet' + (full ? ' full' : '')} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {title !== undefined && (
          <div className="sheet-head">
            <h2>{title}</h2>
            {right}
            <button className="iconbtn" onClick={onClose} aria-label="Sluiten"><I.close /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
export const useToast = create<{ msg: string | null; show: (m: string) => void }>((set) => {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    msg: null,
    show: (msg) => {
      clearTimeout(t);
      set({ msg });
      t = setTimeout(() => set({ msg: null }), 2600);
    },
  };
});
export const toast = (m: string) => useToast.getState().show(m);

export function Toast() {
  const msg = useToast((s) => s.msg);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

const parseNum = (t: string) => parseFloat(t.replace(',', '.'));
const showNum = (v: number) => (Number.isFinite(v) ? String(v).replace('.', ',') : '');

/** Numeric input that accepts a Dutch decimal comma while typing. */
export function NumField({ value, onValue, ...rest }: { value: number; onValue: (v: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(showNum(value));
  useEffect(() => {
    if (parseNum(text) !== value && !(text === '' && value === 0)) setText(showNum(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal" {...rest} value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseNum(e.target.value);
        onValue(Number.isFinite(v) ? v : 0);
      }}
    />
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, id }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; id?: string }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  return (
    <div className="stepper">
      <button onClick={() => onChange(clamp(value - step))} aria-label="Minder">−</button>
      <NumField id={id} className="input num" value={value} onValue={(v) => onChange(Math.min(max, v))} />
      <button onClick={() => onChange(clamp(value + step))} aria-label="Meer">+</button>
    </div>
  );
}

/* ---------- Simple charts ---------- */
/** Rounds up to a "nice" axis step: 1, 2, 2.5 or 5 × 10^n. */
export function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

export function BarChart({ data, target, color, unit = '', height = 150 }: { data: { label: string; value: number }[]; target?: number; color: string; unit?: string; height?: number }) {
  const W = 320, H = height, padL = 34, padB = 20, padT = 10;
  const step = niceStep((Math.max(1, target ?? 0, ...data.map((d) => d.value)) * 1.05) / 2);
  const max = step * 2;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const bw = (W - padL) / data.length;
  const ticks = [0, step, max];
  const showEvery = data.length > 10 ? Math.ceil(data.length / 7) : 1;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end">{t >= 1000 ? `${(t / 1000).toLocaleString('nl-NL')}k` : t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = Math.max(0, H - padB - y(d.value));
        const over = target !== undefined && d.value > target * 1.05 && unit === 'kcal';
        return (
          <g key={i}>
            <rect x={padL + i * bw + bw * 0.18} y={H - padB - h} width={bw * 0.64} height={h} rx={Math.min(6, bw * 0.3)} fill={over ? 'var(--protein)' : color} opacity={d.value ? 1 : 0.25} />
            {i % showEvery === 0 && <text x={padL + i * bw + bw / 2} y={H - 5} textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
      {target !== undefined && (
        <line x1={padL} x2={W} y1={y(target)} y2={y(target)} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.55} />
      )}
    </svg>
  );
}

export function LineChart({ points, goal, height = 160 }: { points: { label: string; value: number }[]; goal?: number; height?: number }) {
  const W = 320, H = height, padL = 34, padB = 20, padT = 12;
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value).concat(goal ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5);
  const x = (i: number) => padL + 8 + (points.length === 1 ? (W - padL - 16) / 2 : (i * (W - padL - 16)) / (points.length - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${d} L${x(points.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  const showEvery = Math.max(1, Math.ceil(points.length / 6));
  const last = points[points.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      <defs>
        <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end">{t.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}</text>
        </g>
      ))}
      {goal !== undefined && <line x1={padL} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--carb)" strokeWidth={1.5} strokeDasharray="6 4" />}
      <path d={area} fill="url(#wfill)" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 2.5} fill={i === points.length - 1 ? 'var(--brand)' : 'var(--surface)'} stroke="var(--brand)" strokeWidth={2} />
          {i % showEvery === 0 && <text x={x(i)} y={H - 5} textAnchor="middle">{p.label}</text>}
        </g>
      ))}
      <text x={x(points.length - 1)} y={y(last.value) - 10} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 700, fontSize: 11 }}>
        {last.value.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg
      </text>
    </svg>
  );
}
