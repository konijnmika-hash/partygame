import { useEffect, useRef, useState } from 'react';

/**
 * Geanimeerd sportfiguurtje. Een pose is een set hoeken (graden; 0 = omhoog, 90 = naar voren/rechts,
 * 180 = omlaag, 270 = naar achteren/links) voor elk lichaamsdeel. Eén punt (anchor) staat vast,
 * de rest volgt. De animatie wisselt soepel tussen pose A en pose B.
 */
export interface Pose {
  anchor: 'foot' | 'hip' | 'hand' | 'knee' | 'toe' | 'elbow';
  at: [number, number];
  torso: number;
  thigh: number;
  shin: number;
  arm: number;
  fore: number;
  thigh2?: number;
  shin2?: number;
  arm2?: number;
  fore2?: number;
  foot?: number;
  foot2?: number;
  neck?: number;
}

export type Seg = 'torso' | 'arm' | 'fore' | 'thigh' | 'shin';

export type Prop =
  | { k: 'plate'; at: Joint; r?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; legs?: boolean }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number }
  | { k: 'cable'; from: [number, number]; to: Joint }
  | { k: 'pad'; at: Joint; angle: number; len?: number };

type Joint = 'wrist' | 'wrist2' | 'shoulder' | 'hip' | 'ankle' | 'ankle2' | 'knee';

export interface Anim {
  a: Pose;
  b: Pose;
  props?: Prop[];
  hi?: Seg[];
  view?: 'side' | 'front';
  /** seconden per herhaling */
  speed?: number;
}

const L = { torso: 25, neck: 9.5, arm: 14, fore: 13, thigh: 19, shin: 19, foot: 7 };
const rad = (a: number) => (a * Math.PI) / 180;
const dir = (a: number, len: number): [number, number] => [Math.sin(rad(a)) * len, -Math.cos(rad(a)) * len];
const add = (p: [number, number], q: [number, number]): [number, number] => [p[0] + q[0], p[1] + q[1]];

type Pts = Record<'head' | 'shoulder' | 'shoulder2' | 'elbow' | 'wrist' | 'elbow2' | 'wrist2' | 'hip' | 'hip2' | 'knee' | 'ankle' | 'toe' | 'knee2' | 'ankle2' | 'toe2', [number, number]>;

export function solve(p: Pose, front = false): Pts {
  const hip: [number, number] = [0, 0];
  const shoulderC = add(hip, dir(p.torso, L.torso));
  const head = add(shoulderC, dir(p.neck ?? p.torso, L.neck));
  // vooraanzicht: schouders en heupen uit elkaar
  const sw = front ? 7 : 0;
  const hw = front ? 4 : 0;
  const shoulder = add(shoulderC, [sw, 0]);
  const shoulder2 = add(shoulderC, [-sw, 0]);
  const hipA = add(hip, [hw, 0]);
  const hipB = add(hip, [-hw, 0]);
  const elbow = add(shoulder, dir(p.arm, L.arm));
  const wrist = add(elbow, dir(p.fore, L.fore));
  const elbow2 = add(shoulder2, dir(p.arm2 ?? p.arm, L.arm));
  const wrist2 = add(elbow2, dir(p.fore2 ?? p.fore, L.fore));
  const knee = add(hipA, dir(p.thigh, L.thigh));
  const ankle = add(knee, dir(p.shin, L.shin));
  const toe = add(ankle, dir(p.foot ?? (front ? p.shin : p.shin - 90), front ? 2 : L.foot));
  const knee2 = add(hipB, dir(p.thigh2 ?? p.thigh, L.thigh));
  const ankle2 = add(knee2, dir(p.shin2 ?? p.shin, L.shin));
  const toe2 = add(ankle2, dir(p.foot2 ?? p.foot ?? (front ? p.shin2 ?? p.shin : (p.shin2 ?? p.shin) - 90), front ? 2 : L.foot));
  const pts: Pts = { head, shoulder, shoulder2, elbow, wrist, elbow2, wrist2, hip: hipA, hip2: hipB, knee, ankle, toe, knee2, ankle2, toe2 };
  const ref = { foot: ankle, hip, hand: wrist, knee, toe, elbow }[p.anchor];
  const dx = p.at[0] - ref[0];
  const dy = p.at[1] - ref[1];
  for (const k of Object.keys(pts) as (keyof Pts)[]) pts[k] = [pts[k][0] + dx, pts[k][1] + dy];
  return pts;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};

export function mix(a: Pose, b: Pose, t: number): Pose {
  const keys = ['torso', 'thigh', 'shin', 'arm', 'fore', 'thigh2', 'shin2', 'arm2', 'fore2', 'foot', 'foot2', 'neck'] as const;
  const out: Pose = { ...a, at: [lerp(a.at[0], b.at[0], t), lerp(a.at[1], b.at[1], t)] };
  for (const k of keys) {
    const va = a[k] ?? (k.endsWith('2') ? a[k.slice(0, -1) as 'arm'] : undefined);
    const vb = b[k] ?? (k.endsWith('2') ? b[k.slice(0, -1) as 'arm'] : undefined);
    if (va === undefined || vb === undefined) continue;
    (out as unknown as Record<string, number>)[k] = lerpAngle(va, vb, t);
  }
  return out;
}

const seg = (p: [number, number], q: [number, number], w: number, color: string, key: string) => (
  <line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={w} strokeLinecap="round" />
);

export function FigureFrame({ anim, pose }: { anim: Anim; pose: Pose }) {
  const front = anim.view === 'front';
  const P = solve(pose, front);
  const hi = new Set(anim.hi ?? []);
  const body = 'var(--fig-body)';
  const far = 'var(--fig-far)';
  const acc = 'var(--fig-hi)';
  const c = (s: Seg, near = true) => (hi.has(s) ? (near ? acc : 'var(--fig-hi-far)') : near ? body : far);
  const J = (j: Joint) => P[j];

  const props = (anim.props ?? []).map((pr, i) => {
    switch (pr.k) {
      case 'rect':
        return (
          <g key={i}>
            <rect x={pr.x} y={pr.y} width={pr.w} height={pr.h} rx={2} fill="var(--fig-prop)" />
            {pr.legs && (
              <>
                <rect x={pr.x + 3} y={pr.y + pr.h} width={2.5} height={92 - pr.y - pr.h} fill="var(--fig-prop)" />
                <rect x={pr.x + pr.w - 5.5} y={pr.y + pr.h} width={2.5} height={92 - pr.y - pr.h} fill="var(--fig-prop)" />
              </>
            )}
          </g>
        );
      case 'line':
        return <line key={i} x1={pr.x1} y1={pr.y1} x2={pr.x2} y2={pr.y2} stroke="var(--fig-prop)" strokeWidth={pr.w ?? 3} strokeLinecap="round" />;
      case 'cable': {
        const t = J(pr.to);
        return (
          <g key={i}>
            <line x1={pr.from[0]} y1={pr.from[1]} x2={t[0]} y2={t[1]} stroke="var(--fig-prop)" strokeWidth={1.2} />
            <circle cx={pr.from[0]} cy={pr.from[1]} r={2.6} fill="var(--fig-prop)" />
          </g>
        );
      }
      case 'pad': {
        const at = J(pr.at);
        const d = dir(pr.angle, (pr.len ?? 12) / 2);
        return <line key={i} x1={at[0] - d[0]} y1={at[1] - d[1]} x2={at[0] + d[0]} y2={at[1] + d[1]} stroke="var(--fig-prop)" strokeWidth={4} strokeLinecap="round" />;
      }
      default:
        return null;
    }
  });
  const plates = (anim.props ?? []).filter((p): p is Extract<Prop, { k: 'plate' }> => p.k === 'plate').map((pr, i) => {
    const at = J(pr.at);
    const r = pr.r ?? 7;
    return (
      <g key={'p' + i}>
        <circle cx={at[0]} cy={at[1]} r={r} fill="var(--fig-plate)" />
        <circle cx={at[0]} cy={at[1]} r={Math.max(1.2, r * 0.28)} fill="var(--fig-bg)" />
      </g>
    );
  });

  return (
    <g>
      <line x1={4} y1={92.5} x2={116} y2={92.5} stroke="var(--fig-ground)" strokeWidth={1.2} strokeLinecap="round" />
      {props}
      {/* achterste ledematen */}
      {seg(P.hip2, P.knee2, 6.5, c('thigh', false), 't2')}
      {seg(P.knee2, P.ankle2, 6, c('shin', false), 's2')}
      {seg(P.ankle2, P.toe2, 4.5, far, 'f2')}
      {seg(P.shoulder2, P.elbow2, 5.2, c('arm', false), 'a2')}
      {seg(P.elbow2, P.wrist2, 4.6, c('fore', false), 'fa2')}
      {/* romp en hoofd */}
      {front ? (
        <>
          {seg(P.hip, P.hip2, 8, c('torso'), 'hb')}
          {seg(P.shoulder, P.shoulder2, 9, c('torso'), 'sb')}
          {seg([(P.hip[0] + P.hip2[0]) / 2, P.hip[1]], [(P.shoulder[0] + P.shoulder2[0]) / 2, P.shoulder[1]], 12, c('torso'), 'tr')}
        </>
      ) : (
        seg(P.hip, P.shoulder, 9.5, c('torso'), 'tr')
      )}
      <circle cx={P.head[0]} cy={P.head[1]} r={6.2} fill={body} />
      {/* voorste ledematen */}
      {seg(P.hip, P.knee, 7, c('thigh'), 't')}
      {seg(P.knee, P.ankle, 6.2, c('shin'), 's')}
      {seg(P.ankle, P.toe, 4.8, body, 'f')}
      {seg(P.shoulder, P.elbow, 5.6, c('arm'), 'a')}
      {seg(P.elbow, P.wrist, 5, c('fore'), 'fa')}
      {plates}
    </g>
  );
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Speelt de beweging af. `still` toont alleen de eindpositie (voor kleine thumbnails). */
export function Figure({ anim, still = false, size, className }: { anim: Anim; still?: boolean; size?: number; className?: string }) {
  const [t, setT] = useState(still ? 1 : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (still || reduced()) {
      setT(still ? 1 : 0.5);
      return;
    }
    const period = (anim.speed ?? 2.6) * 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const ph = ((now - start) % period) / period;
      // heen in 45%, kort vasthouden, terug in 45%
      const x = ph < 0.45 ? ph / 0.45 : ph < 0.55 ? 1 : 1 - (ph - 0.55) / 0.45;
      setT(0.5 - Math.cos(Math.PI * x) / 2);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [anim, still]);
  return (
    <svg viewBox="0 -10 120 110" width={size} height={size ? (size * 110) / 120 : undefined} className={'figure ' + (className ?? '')} role="img" aria-hidden>
      <FigureFrame anim={anim} pose={mix(anim.a, anim.b, t)} />
    </svg>
  );
}
