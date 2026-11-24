import type { Sex } from '../lib/types';

/** Vooraanzicht-silhouet dat breder/gespierder wordt met de schalen voor vet en spieren (1-10). */
export function Body({ fat, muscle, sex }: { fat: number; muscle: number; sex: Sex }) {
  const f = (fat - 1) / 9;
  const m = (muscle - 1) / 9;
  const fem = sex === 'vrouw' ? 1 : sex === 'anders' ? 0.5 : 0;
  const cx = 60;
  const sh = 21 + m * 9 + f * 4 - fem * 3; // halve schouderbreedte
  const waist = 12 + f * 15 + m * 2 - fem * 1.5;
  const hip = 15 + f * 11 + fem * 5 + m * 1.5;
  const belly = f > 0.35 ? (f - 0.35) * 22 : 0;
  const arm = 6.5 + m * 4.5 + f * 3.5;
  const leg = 10 + m * 3.5 + f * 6 + fem * 1;
  const neck = 6 + m * 2.5 + f * 1.5;
  const yS = 46, yW = 86, yH = 106;

  const torso = `M ${cx - neck} 36
    C ${cx - neck} 41, ${cx - sh + 4} 41, ${cx - sh} ${yS}
    C ${cx - sh - 2} ${yS + 14}, ${cx - waist - belly} ${yW - 16}, ${cx - waist - belly * 0.8} ${yW}
    C ${cx - waist - belly * 0.6} ${yW + 10}, ${cx - hip} ${yH - 6}, ${cx - hip} ${yH}
    C ${cx - hip + 2} ${yH + 9}, ${cx + hip - 2} ${yH + 9}, ${cx + hip} ${yH}
    C ${cx + hip} ${yH - 6}, ${cx + waist + belly * 0.6} ${yW + 10}, ${cx + waist + belly * 0.8} ${yW}
    C ${cx + waist + belly} ${yW - 16}, ${cx + sh + 2} ${yS + 14}, ${cx + sh} ${yS}
    C ${cx + sh - 4} 41, ${cx + neck} 41, ${cx + neck} 36 Z`;

  const armPath = (side: 1 | -1) => {
    const x0 = cx + side * (sh - arm * 0.35);
    const x1 = cx + side * (sh + 4 + f * 4);
    const x2 = cx + side * (hip + 6 + f * 2);
    return `M ${x0} ${yS + 2} Q ${x1} ${yS + 26} ${x2} ${yH + 6}`;
  };
  const legPath = (side: 1 | -1) => `M ${cx + side * (hip * 0.48)} ${yH - 4} L ${cx + side * (hip * 0.42 + 2)} 162`;

  return (
    <svg viewBox="0 0 120 172" className="body-svg" role="img" aria-label="Silhouet volgens je keuze">
      <defs>
        <linearGradient id="bodyfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand-2)" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <ellipse cx={cx} cy={166} rx={34} ry={4} fill="var(--line)" />
      {[1, -1].map((s) => <path key={'l' + s} d={legPath(s as 1 | -1)} stroke="url(#bodyfill)" strokeWidth={leg} strokeLinecap="round" fill="none" />)}
      {[1, -1].map((s) => <path key={'a' + s} d={armPath(s as 1 | -1)} stroke="url(#bodyfill)" strokeWidth={arm} strokeLinecap="round" fill="none" />)}
      <path d={torso} fill="url(#bodyfill)" />
      <circle cx={cx} cy={23} r={13} fill="url(#bodyfill)" />
      {/* spierlijnen bij meer spieren en weinig vet */}
      {m > 0.45 && (
        <g stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={Math.min(1, (m - 0.45) * 2.5) * (1 - f * 0.8)}>
          <path d={`M ${cx - sh + 7} ${yS + 9} Q ${cx - 6} ${yS + 16} ${cx} ${yS + 12} Q ${cx + 6} ${yS + 16} ${cx + sh - 7} ${yS + 9}`} />
          {f < 0.5 && (
            <>
              <path d={`M ${cx} ${yS + 20} L ${cx} ${yW + 6}`} />
              <path d={`M ${cx - 7} ${yS + 27} L ${cx + 7} ${yS + 27} M ${cx - 7} ${yS + 36} L ${cx + 7} ${yS + 36}`} />
            </>
          )}
        </g>
      )}
    </svg>
  );
}
