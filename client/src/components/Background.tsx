import { memo } from 'react';

const SHAPES = [
  { c: '#FF4F9A', x: 6, y: 14, s: 80, d: 0, k: 'blob' },
  { c: '#FFD23F', x: 86, y: 10, s: 54, d: 2, k: 'star' },
  { c: '#2DE2E6', x: 78, y: 74, s: 90, d: 4, k: 'blob' },
  { c: '#7B5CFF', x: 14, y: 80, s: 64, d: 1, k: 'ring' },
  { c: '#34CF78', x: 48, y: 6, s: 36, d: 3, k: 'tri' },
  { c: '#FF8A3D', x: 92, y: 44, s: 40, d: 5, k: 'ring' },
  { c: '#FFD23F', x: 4, y: 48, s: 30, d: 2.5, k: 'star' },
  { c: '#FF4F9A', x: 60, y: 92, s: 44, d: 1.5, k: 'tri' },
];

function shape(k: string, c: string) {
  switch (k) {
    case 'star':
      return <path d="M50 4l13 30 32 3-24 21 7 32-28-17-28 17 7-32L5 37l32-3z" fill={c} />;
    case 'ring':
      return <circle cx="50" cy="50" r="36" fill="none" stroke={c} strokeWidth="16" />;
    case 'tri':
      return <path d="M50 8l42 80H8z" fill={c} />;
    default:
      return <path d="M50 10c24 0 40 18 40 40s-14 40-40 40S10 72 10 50 26 10 50 10z" fill={c} />;
  }
}

/** Drifting playful shapes behind every screen. Pure CSS animation, pointer-events: none. */
export const Background = memo(function Background() {
  return (
    <div className="bg-shapes" aria-hidden="true">
      {SHAPES.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 100 100"
          className="bg-shape"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `-${s.d * 3}s`, animationDuration: `${14 + i * 2}s` }}
        >
          {shape(s.k, s.c)}
        </svg>
      ))}
    </div>
  );
});
