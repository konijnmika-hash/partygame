// Tekent een recept als een "flat lay" foodfoto: ondergrond, servies, gerecht en licht.
// Alles is vector, dus scherp op elk scherm en werkt offline. Een echte foto (recipe.photo) gaat voor.
import { memo, useId, type ReactNode } from 'react';
import type { Art, Base, Bg, Item, Part, Recipe } from '../data/recipes';

const W = 400;
const H = 300;

/* ---------- toeval dat per recept hetzelfde blijft ---------- */
function rngFor(seed: string) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a ^ seed.charCodeAt(i), 2654435761) + 0x9e3779b9) | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const pick = <T,>(rng: Rng, arr: T[]) => arr[Math.floor(rng() * arr.length)];
const jitter = (rng: Rng, n: number) => (rng() - 0.5) * 2 * n;

/* ---------- geometrie per servies ---------- */
interface Frame {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}
function frameFor(art: Art): Frame {
  switch (art.dish) {
    case 'kom': return { cx: 200, cy: 150, rx: 94, ry: 94 };
    case 'bord': return { cx: 200, cy: 150, rx: 100, ry: 100 };
    case 'pan': return { cx: 186, cy: 150, rx: 96, ry: 96 };
    case 'plank': return { cx: 200, cy: 150, rx: 140, ry: 86 };
    case 'pot':
    case 'glas': return { cx: 200, cy: 82, rx: 56, ry: 13 };
  }
}

/** Verspreidt n punten binnen een cirkel zonder dat ze te veel overlappen. */
function scatter(rng: Rng, n: number, cx: number, cy: number, rx: number, ry: number, minD: number) {
  if (n === 1) return [[cx, cy]];
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    let best: number[] = [cx, cy];
    let bestD = -1;
    for (let t = 0; t < 24; t++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng());
      const p = [cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry];
      const d = pts.reduce((m, q) => Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])), Infinity);
      if (d >= minD) { best = p; break; }
      if (d > bestD) { bestD = d; best = p; }
    }
    pts.push(best);
  }
  return pts;
}

/* ---------- ingrediënten (getekend in een kader met straal 10) ---------- */
const SPRINKLE = new Set<Item>(['chia', 'sesam', 'pompoenpit', 'kokos', 'chilivlok', 'peper', 'kaas', 'parmezaan', 'mais', 'lente-ui']);
const DRIZZLE: Partial<Record<Item, [string, number]>> = { honing: ['#e9a524', 3], ahorn: ['#b8651c', 2.6], 'pesto-druppel': ['#5d8a2a', 2.4] };

function blob(rng: Rng, r: number, pts = 9, wob = 0.18) {
  const p: string[] = [];
  const pts2: number[][] = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (1 + jitter(rng, wob));
    pts2.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (let i = 0; i < pts; i++) {
    const a = pts2[i];
    const b = pts2[(i + 1) % pts];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (i === 0) p.push(`M${((pts2[pts - 1][0] + a[0]) / 2).toFixed(1)},${((pts2[pts - 1][1] + a[1]) / 2).toFixed(1)}`);
    p.push(`Q${a[0].toFixed(1)},${a[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`);
  }
  return p.join(' ') + 'Z';
}

function drawItem(k: Item, rng: Rng, id: string): ReactNode {
  switch (k) {
    case 'blauwe-bes':
      return <><circle r={10} fill={`url(#${id}-bes)`} /><circle r={10} fill="#8d97d8" opacity={0.25} /><path d="M-2.5,-3 l2.5,1.5 2.5,-1.5 -1,2.8 1.5,2 -3,-.4 -3,.4 1.5,-2z" fill="#20193d" opacity={0.85} /><ellipse cx={-4} cy={-4.5} rx={3} ry={1.8} fill="#fff" opacity={0.35} /></>;
    case 'framboos':
      return <g>{[[0, 0], [5, -2], [-5, -2], [3, 5], [-3, 5], [0, -6], [6, 3], [-6, 3]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.2} fill={i % 2 ? '#c81f4a' : '#d92d57'} />)}{[[0, 0], [5, -2], [-5, -2], [3, 5], [-3, 5], [0, -6]].map(([x, y], i) => <circle key={'h' + i} cx={x - 1.2} cy={y - 1.3} r={1.2} fill="#fff" opacity={0.45} />)}</g>;
    case 'aardbei':
      return <><path d="M0,-10 C7,-10 10,-3 8.5,3 C7,8 2.5,10.5 0,10.5 C-2.5,10.5 -7,8 -8.5,3 C-10,-3 -7,-10 0,-10Z" fill="#e12f45" /><path d="M0,-6.5 C4.5,-6.5 6,-2 5,2.5 C4,6 1.5,7.5 0,7.5 C-1.5,7.5 -4,6 -5,2.5 C-6,-2 -4.5,-6.5 0,-6.5Z" fill="#f7868c" /><path d="M0,-5 C1.5,-1 1.5,3 0,6 C-1.5,3 -1.5,-1 0,-5Z" fill="#fde3df" />{[[-6.5, 1], [6.5, 1], [-5, 6], [5, 6], [-7, -4], [7, -4]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={0.7} ry={1} fill="#f6d25b" />)}<path d="M-5,-10 Q0,-6 5,-10 Q2,-12 0,-11 Q-2,-12 -5,-10Z" fill="#3f8a2c" /></>;
    case 'banaan':
      return <><circle r={10} fill="#e9d48d" /><circle r={8.8} fill="#f8ecc0" /><circle r={4} fill="#efdca0" />{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={Math.cos(i * 1.256) * 2.4} cy={Math.sin(i * 1.256) * 2.4} r={0.7} fill="#7a5a2a" />)}</>;
    case 'appel':
      return <><path d="M-11,4 Q0,-13 11,4 Q0,3 -11,4Z" fill="#f6ecc6" /><path d="M-11,4 Q0,-13 11,4" fill="none" stroke="#c22f2a" strokeWidth={2.4} strokeLinecap="round" /><path d="M-7,3 Q0,-6 7,3" fill="none" stroke="#efe0b0" strokeWidth={1} /><ellipse cx={0} cy={0} rx={1.2} ry={0.8} fill="#6b4a22" /></>;
    case 'kiwi':
      return <><circle r={10} fill="#8a6a3b" /><circle r={9} fill="#7cb036" /><circle r={6.5} fill="#9cc84a" /><circle r={3.2} fill="#eef3cf" />{Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx={Math.cos(i * 0.5236) * 4.6} cy={Math.sin(i * 0.5236) * 4.6} rx={0.9} ry={0.5} transform={`rotate(${i * 30} ${Math.cos(i * 0.5236) * 4.6} ${Math.sin(i * 0.5236) * 4.6})`} fill="#1e1a14" />)}</>;
    case 'mango':
      return <><rect x={-8} y={-8} width={16} height={16} rx={3} fill="#ffad29" /><rect x={-8} y={-8} width={16} height={7} rx={3} fill="#ffc451" /></>;
    case 'granola':
      return <><path d={blob(rng, 9, 8, 0.3)} fill="#c78d42" /><path d={blob(rng, 5, 7, 0.4)} fill="#dcab63" transform={`translate(${jitter(rng, 2)} ${jitter(rng, 2)})`} />{[0, 1, 2].map((i) => <ellipse key={i} cx={jitter(rng, 5)} cy={jitter(rng, 5)} rx={2.2} ry={1.3} fill="#e9c98f" transform={`rotate(${rng() * 180})`} />)}<circle cx={jitter(rng, 4)} cy={jitter(rng, 4)} r={1.4} fill="#8a5a2a" /></>;
    case 'walnoot':
      return <><path d={blob(rng, 10, 10, 0.12)} fill="#9c6a3c" /><path d="M0,-9 Q-3,-4 0,0 Q3,4 0,9" fill="none" stroke="#6b4322" strokeWidth={1.4} /><path d="M-7,-4 Q-4,-1 -6,3 M7,-4 Q4,-1 6,3" fill="none" stroke="#6b4322" strokeWidth={1.1} /><ellipse cx={-3} cy={-4} rx={3} ry={2} fill="#c08d58" opacity={0.6} /></>;
    case 'amandel':
      return <><path d="M0,-10 C6,-6 7,4 0,10 C-7,4 -6,-6 0,-10Z" fill="#b5743f" /><path d="M0,-7 C2,-3 2,3 0,7 M-3,-4 C-2,0 -2,3 -3,6 M3,-4 C2,0 2,3 3,6" fill="none" stroke="#8d5428" strokeWidth={0.8} opacity={0.7} /><path d="M-2,-7 C1,-6 2,-3 1,-1" stroke="#d9a06c" strokeWidth={1.4} fill="none" /></>;
    case 'chia': return <ellipse rx={1.3} ry={1} fill={pick(rng, ['#2a2622', '#4a443d', '#625a50'])} />;
    case 'sesam': return <ellipse rx={1.5} ry={0.8} fill={pick(rng, ['#f2e3be', '#e8d4a5', '#2b2622'])} />;
    case 'pompoenpit': return <path d="M0,-3.2 C2,-2 2,2 0,3.2 C-2,2 -2,-2 0,-3.2Z" fill={pick(rng, ['#4f7a33', '#5d8a3b', '#6c9845'])} />;
    case 'kokos': return <path d="M-3,0 Q0,-2 3,0" stroke="#fffdf6" strokeWidth={1.4} strokeLinecap="round" fill="none" />;
    case 'chilivlok': return <path d={`M0,0 l${1 + rng()},${rng()} l-${rng()},1.2z`} fill={pick(rng, ['#c0261b', '#d9401f', '#9e1b14'])} />;
    case 'peper': return <circle r={0.6 + rng() * 0.5} fill={pick(rng, ['#2b2520', '#4a3f35'])} opacity={0.8} />;
    case 'kaas': return <path d="M-3,0 Q0,-1 3,0.5" stroke="#f5c84c" strokeWidth={1.3} strokeLinecap="round" fill="none" />;
    case 'parmezaan': return <path d={`M-2.5,${jitter(rng, 1)} Q0,-1 2.5,${jitter(rng, 1)}`} stroke="#f6e7b4" strokeWidth={1.2} strokeLinecap="round" fill="none" />;
    case 'mais': return <><rect x={-3} y={-3} width={6} height={6} rx={2} fill="#f5c935" /><rect x={-2} y={-2.4} width={3} height={2} rx={1} fill="#fde38a" /></>;
    case 'lente-ui': return <><circle r={3.2} fill="none" stroke="#63a83a" strokeWidth={1.6} /><circle r={1.4} fill="none" stroke="#a7d47a" strokeWidth={0.8} /></>;
    case 'kruid':
    case 'peterselie': {
      const c = k === 'kruid' ? '#4b8a2c' : '#3f7d25';
      return <g>{[0, 72, 144, 216, 288].map((a) => <path key={a} d="M0,0 C2,-3 1.5,-7 0,-9 C-1.5,-7 -2,-3 0,0Z" fill={c} transform={`rotate(${a + jitter(rng, 15)})`} />)}<circle r={1.2} fill="#6aa83f" /></g>;
    }
    case 'gebakken-ei':
      return <><path d={blob(rng, 10, 9, 0.16)} fill="#fbfaf3" /><path d={blob(rng, 8.5, 9, 0.12)} fill="#ffffff" opacity={0.7} /><circle cx={jitter(rng, 1.5)} cy={jitter(rng, 1.5)} r={4.2} fill="url(#YOLK)" /><ellipse cx={-1.2} cy={-1.6} rx={1.4} ry={0.9} fill="#fff" opacity={0.6} /></>;
    case 'half-ei':
      return <><ellipse rx={8} ry={10} fill="#fbfaf3" /><ellipse rx={8} ry={10} fill="none" stroke="#e8e2d0" strokeWidth={0.8} /><circle cy={0.5} r={4.6} fill="#f6b22e" /><circle cy={0.5} r={3} fill="#fac652" /></>;
    case 'roerei':
      return <g>{Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; const r = i === 0 ? 0 : 5 + rng() * 2; return <path key={i} d={blob(rng, 4 + rng() * 1.5, 7, 0.3)} fill={i % 3 ? '#f7d75d' : '#f9e27f'} transform={`translate(${Math.cos(a) * r} ${Math.sin(a) * r})`} />; })}{[0, 1, 2, 3].map((i) => <circle key={'h' + i} cx={jitter(rng, 6)} cy={jitter(rng, 6)} r={1.2} fill="#fff6cf" />)}</g>;
    case 'avocado':
      return <><path d="M-11,-1 Q0,-9 11,-1 Q0,5 -11,-1Z" fill="#a9c94f" /><path d="M-11,-1 Q0,-9 11,-1" fill="none" stroke="#2f4d1b" strokeWidth={1.8} /><path d="M-9,-1 Q0,-6.5 9,-1" fill="none" stroke="#d6e486" strokeWidth={1.6} opacity={0.8} /></>;
    case 'avocado-mash':
      return <><path d={blob(rng, 10, 10, 0.12)} fill="#97bd47" />{Array.from({ length: 14 }, (_, i) => <circle key={i} cx={jitter(rng, 7)} cy={jitter(rng, 7)} r={0.8 + rng()} fill={i % 2 ? '#c4d96f' : '#7da23a'} />)}</>;
    case 'cherrytomaat':
      return <><circle r={10} fill="#d92b21" /><circle r={8.3} fill="#f2523b" />{[0, 120, 240].map((a) => <path key={a} d="M0,0 C3,-2 4,-6 1,-7.5 C-2,-7 -3,-3 0,0Z" fill="#ff8a6a" transform={`rotate(${a})`} />)}{[0, 120, 240].map((a) => <circle key={'s' + a} cx={Math.cos((a - 90) * Math.PI / 180) * 4.4} cy={Math.sin((a - 90) * Math.PI / 180) * 4.4} r={0.9} fill="#fce7a0" />)}<circle r={1.6} fill="#ffb59a" /></>;
    case 'tomaat':
      return <><circle r={10} fill="#d62f23" /><circle r={8.8} fill="#ef4b36" />{[0, 90, 180, 270].map((a) => <path key={a} d="M0,-1.5 C3,-3 5,-6 1,-7.8 C-3,-6.5 -3,-3 0,-1.5Z" fill="#ff8467" transform={`rotate(${a + 45})`} />)}<circle r={2} fill="#ffb59a" /></>;
    case 'komkommer':
      return <><circle r={10} fill="#2f6b26" /><circle r={9} fill="#bfe08f" /><circle r={7.2} fill="#d7ecb0" />{[0, 120, 240].map((a) => <ellipse key={a} cx={Math.cos(a * Math.PI / 180) * 2.6} cy={Math.sin(a * Math.PI / 180) * 2.6} rx={1.6} ry={0.9} fill="#f3f7dd" transform={`rotate(${a} ${Math.cos(a * Math.PI / 180) * 2.6} ${Math.sin(a * Math.PI / 180) * 2.6})`} />)}</>;
    case 'sla':
      return <><path d="M0,-10 C6,-10 11,-4 10,2 C9,8 4,10 0,10 C-4,10 -9,8 -10,2 C-11,-4 -6,-10 0,-10Z" fill="#87c043" /><path d="M0,-8 C4,-8 8,-3 7,2 C6,6 3,8 0,8 C-3,8 -6,6 -7,2 C-8,-3 -4,-8 0,-8Z" fill="#a6d45e" /><path d="M0,9 L0,-8 M0,0 L5,-4 M0,4 L-5,0 M0,-3 L-4,-6" stroke="#d8eea6" strokeWidth={0.9} fill="none" /></>;
    case 'rucola':
      return <><path d="M0,10 L0,-10 M0,-10 C3,-9 4,-6 2,-5 C5,-4 5,-1 2,0 C5,1 5,4 2,5 C3,7 2,9 0,10 C-2,9 -3,7 -2,5 C-5,4 -5,1 -2,0 C-5,-1 -5,-4 -2,-5 C-4,-6 -3,-9 0,-10Z" fill="#4f8a2b" /><path d="M0,10 L0,-8" stroke="#8fbf5a" strokeWidth={0.8} /></>;
    case 'spinazie':
      return <><path d="M0,10 C-7,6 -8,-4 0,-10 C8,-4 7,6 0,10Z" fill="#2e6a2a" /><path d="M0,9 L0,-8" stroke="#5f9c49" strokeWidth={0.9} /><path d="M0,-2 L-4,-5 M0,2 L4,-1" stroke="#4c8a3b" strokeWidth={0.6} /></>;
    case 'zalm':
      return <><rect x={-12} y={-7.5} width={24} height={15} rx={5} fill="#e8794c" /><rect x={-12} y={-7.5} width={24} height={15} rx={5} fill="url(#GLAZE)" />{[-7, -2, 3, 8].map((x) => <path key={x} d={`M${x},-7 Q${x - 2.5},0 ${x},7`} stroke="#ffd3bc" strokeWidth={1.1} fill="none" opacity={0.85} />)}<rect x={-12} y={4.5} width={24} height={3} rx={1.5} fill="#8a4a33" opacity={0.6} /></>;
    case 'gerookte-zalm':
      return <><path d="M-11,-3 C-6,-9 -1,2 4,-5 C8,-9 12,-2 10,3 C6,9 1,0 -4,6 C-8,9 -12,3 -11,-3Z" fill="#f1835e" />{[-6, -1, 4].map((x) => <path key={x} d={`M${x},-5 Q${x + 2},0 ${x},5`} stroke="#ffd2bf" strokeWidth={0.9} fill="none" opacity={0.8} />)}</>;
    case 'kip':
      return <><rect x={-12} y={-5} width={24} height={10} rx={4.5} fill="#e7b26f" /><rect x={-12} y={-5} width={24} height={4} rx={2} fill="#f3cf96" />{[-6, 0, 6].map((x) => <path key={x} d={`M${x - 3},5 L${x + 3},-5`} stroke="#8a5328" strokeWidth={1.6} opacity={0.75} strokeLinecap="round" />)}</>;
    case 'kip-stuk':
      return <><path d={blob(rng, 9, 8, 0.2)} fill="#f0c182" /><path d={blob(rng, 5, 7, 0.3)} fill="#f6d8a6" transform="translate(-1 -1.5)" /></>;
    case 'kabeljauw':
      return <><path d="M-14,-4 C-10,-10 8,-10 14,-4 C15,2 12,8 4,9 C-4,10 -14,7 -14,-4Z" fill="#f6f1e5" /><path d="M-14,-4 C-10,-10 8,-10 14,-4 C15,2 12,8 4,9 C-4,10 -14,7 -14,-4Z" fill="none" stroke="#d9a554" strokeWidth={1.6} />{[-8, -3, 2, 7].map((x) => <path key={x} d={`M${x},-6 Q${x + 2},0 ${x},7`} stroke="#e6dcc7" strokeWidth={0.9} fill="none" />)}<ellipse cx={-2} cy={-3} rx={8} ry={3} fill="#e8b766" opacity={0.35} /></>;
    case 'broccoli':
      return <><rect x={-2} y={2} width={4} height={8} rx={2} fill="#9cc56a" /><g>{[[0, -3, 5], [-5, -1, 4.2], [5, -1, 4.2], [-3, -7, 3.8], [3, -7, 3.8], [0, 1, 3.8]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? '#3b8a33' : '#2f7a2c'} />)}</g>{Array.from({ length: 9 }, (_, i) => <circle key={i} cx={jitter(rng, 6)} cy={-3 + jitter(rng, 4)} r={0.9} fill="#5fae4a" />)}</>;
    case 'boon-groen':
      return <><path d={`M-11,${jitter(rng, 2)} Q0,${-4 + jitter(rng, 3)} 11,${jitter(rng, 2)}`} stroke="#3f8a2a" strokeWidth={3.6} strokeLinecap="round" fill="none" /><path d={`M-9,${-1} Q0,${-4.6} 9,-1`} stroke="#79b553" strokeWidth={1} strokeLinecap="round" fill="none" opacity={0.7} /></>;
    case 'wortel':
      return <><circle r={10} fill="#e9761d" /><circle r={7} fill="#f6953a" /><circle r={3.5} fill="#f9b05e" /></>;
    case 'wortelstick':
      return <><rect x={-12} y={-2.6} width={24} height={5.2} rx={2.6} fill="#ee7d22" /><rect x={-12} y={-2.6} width={24} height={1.8} rx={1} fill="#f9a75a" /></>;
    case 'paprika':
    case 'paprika-geel': {
      const c = k === 'paprika' ? ['#d6261d', '#f04a37'] : ['#f2b705', '#ffd34a'];
      return <><path d="M-11,2 Q0,-8 11,2" stroke={c[0]} strokeWidth={4.4} strokeLinecap="round" fill="none" /><path d="M-9,1 Q0,-6.5 9,1" stroke={c[1]} strokeWidth={1.5} strokeLinecap="round" fill="none" /></>;
    }
    case 'kikkererwt':
      return <><circle r={10} fill="#ddb06a" /><path d="M-3,-8 Q2,-2 -2,8" stroke="#b98a45" strokeWidth={1.6} fill="none" /><ellipse cx={3} cy={-3} rx={3.5} ry={2.4} fill="#f2d39a" opacity={0.7} /></>;
    case 'zwarte-boon':
      return <><ellipse rx={10} ry={6.5} fill="#241c22" /><ellipse cx={-3} cy={-2} rx={4} ry={1.6} fill="#6a5a66" opacity={0.6} /><ellipse cx={2} cy={4} rx={2.6} ry={1} fill="#efe6d4" /></>;
    case 'kidneyboon':
      return <><path d="M-10,0 C-10,-7 10,-7 10,0 C10,5 4,4 0,5 C-4,6 -10,6 -10,0Z" fill="#7d1e2c" /><ellipse cx={-3} cy={-2.5} rx={4} ry={1.4} fill="#b04a57" opacity={0.6} /></>;
    case 'edamame':
      return <><ellipse rx={10} ry={8} fill="#7bbf43" /><ellipse cx={-2.5} cy={-2.5} rx={4} ry={2.6} fill="#b8e27e" opacity={0.7} /></>;
    case 'edamame-peul':
      return <><path d="M-12,2 C-12,-4 -6,-5 -4,-3 C-2,-6 2,-6 4,-3 C6,-6 12,-4 12,2 C12,6 6,6 4,3 C2,6 -2,6 -4,3 C-6,6 -12,6 -12,2Z" fill="#5fa333" /><path d="M-10,-1 C-7,-3 -5,-2 -4,-1 M-1,-2 C1,-3.5 3,-2 4,-1 M7,-2 C9,-3 10,-1 10,0" stroke="#a8d877" strokeWidth={1.2} fill="none" />{[-7, 0, 7].map((x) => <circle key={x} cx={x} cy={4} r={0.5} fill="#fff" opacity={0.9} />)}</>;
    case 'feta':
      return <><rect x={-8} y={-8} width={16} height={16} rx={3} fill="#f9f6ea" /><rect x={-8} y={3} width={16} height={5} rx={2} fill="#e6e0cc" /><circle cx={-3} cy={-3} r={0.8} fill="#e2dcc8" /><circle cx={3} cy={-1} r={0.6} fill="#e2dcc8" /></>;
    case 'mozzarella':
    case 'mozzarella-plak':
      return <><path d={blob(rng, 10, 9, 0.12)} fill="#fffdf4" /><path d={blob(rng, 7, 8, 0.2)} fill="#f6f1df" opacity={0.7} /></>;
    case 'falafel':
      return <><circle r={10} fill="#7d4c22" /><circle r={8} fill="#97602f" /><circle cx={-2} cy={-2} r={4.5} fill="#ad7a45" />{Array.from({ length: 10 }, (_, i) => <circle key={i} cx={jitter(rng, 7)} cy={jitter(rng, 7)} r={0.8} fill={i % 2 ? '#3f6e24' : '#5a3214'} />)}</>;
    case 'dollop':
    case 'tzatziki':
      return <><path d={blob(rng, 10, 9, 0.12)} fill="#fbfaf5" /><path d="M-5,-1 C-4,-6 5,-6 5,0 C5,4 -1,5 -2,1 C-2,-1 1,-2 1,0" stroke="#e7e4d8" strokeWidth={1.4} fill="none" />{k === 'tzatziki' && Array.from({ length: 8 }, (_, i) => <circle key={i} cx={jitter(rng, 6)} cy={jitter(rng, 6)} r={0.8} fill="#6aa83f" />)}</>;
    case 'rode-ui':
      return <><circle r={9} fill="none" stroke="#7c2f74" strokeWidth={2} /><circle r={6} fill="none" stroke="#a65aa0" strokeWidth={1.4} /><circle r={9} fill="none" stroke="#e9d4ea" strokeWidth={0.7} /></>;
    case 'citroen':
    case 'limoen': {
      const c = k === 'citroen' ? ['#efc420', '#fbe77a', '#fff6c4'] : ['#4f9a2a', '#a9d860', '#e6f5c4'];
      return <><path d="M-10,0 A10,10 0 0,1 10,0Z" fill={c[0]} /><path d="M-8.4,0 A8.4,8.4 0 0,1 8.4,0Z" fill={c[1]} />{[-60, -30, 0, 30, 60].map((a) => <path key={a} d="M0,0 L0,-7.6" stroke={c[2]} strokeWidth={0.8} transform={`rotate(${a})`} />)}</>;
    }
    case 'champignon':
      return <><path d="M-10,0 C-10,-8 10,-8 10,0 C10,2 6,2 3,2 L3,8 C3,10 -3,10 -3,8 L-3,2 C-6,2 -10,2 -10,0Z" fill="#e9dcc4" /><path d="M-10,0 C-10,-8 10,-8 10,0" fill="none" stroke="#a87b50" strokeWidth={1.6} /><path d="M-7,0 C-6,-4 6,-4 7,0" fill="none" stroke="#d9c6a6" strokeWidth={0.8} /></>;
    case 'krieltje':
      return <><path d={blob(rng, 10, 9, 0.12)} fill="#d99a3a" /><path d={blob(rng, 7.5, 8, 0.15)} fill="#f0c362" transform="translate(-1 -1)" />{[0, 1, 2].map((i) => <circle key={i} cx={jitter(rng, 6)} cy={jitter(rng, 6)} r={1.2} fill="#a76a22" opacity={0.6} />)}</>;
    case 'zoete-aardappel':
      return <><ellipse rx={13} ry={8.5} fill="#7c3a26" /><ellipse rx={11.6} ry={7.2} fill="#f08a3a" /><ellipse cx={-2} cy={-1.5} rx={7} ry={3.5} fill="#f8a85a" opacity={0.7} /></>;
    case 'toast':
    case 'toast-volkoren': {
      const [crust, crumb] = k === 'toast' ? ['#b97536', '#e8c48a'] : ['#7a4a26', '#b98a5a'];
      return <><path d="M-9,10 L-9,-3 C-12,-4 -12,-10 -6,-10 C-3,-12 3,-12 6,-10 C12,-10 12,-4 9,-3 L9,10 C9,11 -9,11 -9,10Z" fill={crust} /><path d="M-7.8,9 L-7.8,-3.6 C-10,-4.6 -10,-8.6 -5.4,-8.8 C-2.6,-10.4 2.6,-10.4 5.4,-8.8 C10,-8.6 10,-4.6 7.8,-3.6 L7.8,9Z" fill={crumb} />{Array.from({ length: 16 }, (_, i) => <circle key={i} cx={jitter(rng, 6.5)} cy={jitter(rng, 8)} r={0.45} fill={k === 'toast' ? '#c99a5e' : '#8c6038'} />)}<path d="M-7,-2 C-3,-5 3,-5 7,-2" stroke="#fff" strokeWidth={1.4} opacity={0.18} fill="none" /></>;
    }
    case 'bagel':
      return <><circle r={10} fill="#b56a2a" /><circle r={8.8} fill="#efd3a0" /><circle r={3.2} fill="#b56a2a" />{Array.from({ length: 14 }, (_, i) => <circle key={i} cx={Math.cos(i * 0.45) * 6} cy={Math.sin(i * 0.45) * 6} r={0.4} fill="#d6b07a" />)}</>;
    case 'cracker':
      return <><rect x={-11} y={-7} width={22} height={14} rx={1.6} fill="#c99456" /><rect x={-10} y={-6} width={20} height={12} rx={1.2} fill="#dbab6a" />{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={-8.5 + (i % 6) * 3.4} cy={-4.2 + Math.floor(i / 6) * 2.8} r={0.5} fill="#a8723a" />)}</>;
    case 'rijstwafel':
      return <><circle r={10} fill="#ecdcb8" /><circle r={9} fill="#f6ead0" />{Array.from({ length: 30 }, (_, i) => <ellipse key={i} cx={jitter(rng, 7)} cy={jitter(rng, 7)} rx={1.2} ry={0.7} fill="#e2cfa6" transform={`rotate(${rng() * 180})`} />)}</>;
    case 'wrap':
      return <><circle r={10} fill="#e2bf7e" /><circle r={9} fill="#f3dcaa" /><circle r={7.6} fill="#5e9b35" /><path d="M0,0 m-6,0 a6,6 0 1,0 12,0 a4.4,4.4 0 1,0 -8.8,0 a3,3 0 1,0 6,0" fill="none" stroke="#f4e0b4" strokeWidth={1.4} />{[[2, -3, '#e8b46c'], [-3, 2, '#e24a35'], [3, 3, '#fdfbf2'], [-2, -3, '#e8b46c'], [0, 0, '#e24a35']].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={1.8} fill={c as string} />)}</>;
    case 'pannenkoek':
      return <><circle r={10} fill="#b4702c" /><circle r={9.2} fill="url(#PANCAKE)" />{Array.from({ length: 8 }, (_, i) => <circle key={i} cx={jitter(rng, 6)} cy={jitter(rng, 6)} r={0.5} fill="#c98a45" />)}</>;
    case 'energiebal':
      return <><circle r={10} fill="#5b3721" /><circle cx={-2} cy={-2} r={6.5} fill="#704630" />{Array.from({ length: 12 }, (_, i) => <path key={i} d="M-1.2,0 Q0,-0.8 1.2,0" stroke="#fffbf0" strokeWidth={0.9} fill="none" transform={`translate(${jitter(rng, 7)} ${jitter(rng, 7)}) rotate(${rng() * 180})`} />)}</>;
    case 'chocola':
      return <><rect x={-10} y={-10} width={20} height={20} rx={1.5} fill="#3e2318" /><rect x={-8.5} y={-8.5} width={7.5} height={7.5} rx={1} fill="#4f2d1f" /><rect x={1} y={-8.5} width={7.5} height={7.5} rx={1} fill="#4f2d1f" /><rect x={-8.5} y={1} width={7.5} height={7.5} rx={1} fill="#4f2d1f" /><rect x={1} y={1} width={7.5} height={7.5} rx={1} fill="#4f2d1f" /></>;
    case 'dadel':
      return <><ellipse rx={11} ry={5.5} fill="#5a2a14" /><path d="M-7,-1 Q0,-4 7,-1 M-6,2 Q0,0 6,2" stroke="#7d4024" strokeWidth={1} fill="none" /></>;
    case 'paksoi':
      return <><path d="M0,10 C-3,6 -9,1 -8,-5 C-6,-11 6,-11 8,-5 C9,1 3,6 0,10Z" fill="#3f7f2c" /><path d="M0,10 C-1.6,4 -1.6,-2 0,-7 C1.6,-2 1.6,4 0,10Z" fill="#eaf3d6" /><path d="M0,-6 L-5,-6 M0,-2 L5,-4" stroke="#6aa64a" strokeWidth={0.7} /></>;
    case 'croutons':
      return <><rect x={-6} y={-6} width={12} height={12} rx={2.5} fill="#c98a3c" /><rect x={-5} y={-5} width={8} height={6} rx={2} fill="#e3b46a" /></>;
    case 'hummus':
      return <><circle r={10} fill="#e9e3d6" /><circle r={8.6} fill="#e3c28a" /><path d="M0,0 m-5,0 a5,5 0 1,1 10,0 a3.4,3.4 0 1,1 -6.8,0" fill="none" stroke="#cfa665" strokeWidth={1.2} /><circle r={2.2} fill="#c7a12a" opacity={0.7} />{Array.from({ length: 6 }, (_, i) => <circle key={i} cx={jitter(rng, 5)} cy={jitter(rng, 5)} r={0.6} fill="#b8401f" />)}</>;
    case 'pompoen':
      return <><path d={blob(rng, 9, 6, 0.15)} fill="#e47d1e" /><path d={blob(rng, 6, 6, 0.15)} fill="#f39a3d" /></>;
    case 'gnocchi':
      return <><ellipse rx={10} ry={7} fill="#e9cc8e" /><ellipse rx={8} ry={5} fill="#f2dca8" />{[-4, 0, 4].map((x) => <path key={x} d={`M${x},-5 L${x},5`} stroke="#d6b06a" strokeWidth={0.9} />)}</>;
    case 'rijst':
      return <><path d={blob(rng, 10, 9, 0.1)} fill="#f2efe6" /><path d={blob(rng, 10, 9, 0.1)} fill="url(#RICE)" /></>;
    case 'quinoa':
      return <path d={blob(rng, 10, 9, 0.1)} fill="url(#QUINOA)" />;
    case 'honing':
    case 'ahorn':
    case 'pesto-druppel':
      return null;
  }
}

/* ---------- bases ---------- */
function drawBase(base: Base, r: number, rng: Rng, onPlate: boolean): ReactNode {
  const fill = (f: string, extra?: ReactNode) => <>{<circle r={r} fill={f} />}{extra}</>;
  switch (base) {
    case 'kwark':
      return fill('#f7f4ec', <><circle r={r} fill="url(#CREAM)" />{[0.3, 0.55, 0.75].map((k, i) => <path key={i} d={`M${-r * k},${jitter(rng, 4)} C${-r * k * 0.4},${-r * k * 0.6} ${r * k * 0.6},${-r * k * 0.4} ${r * k},${jitter(rng, 4)}`} stroke="#e8e3d6" strokeWidth={2.5} fill="none" />)}</>);
    case 'pap':
      return fill('#e2cba0', <><circle r={r} fill="url(#OATS)" /><circle r={r} fill="url(#CREAM)" opacity={0.5} /></>);
    case 'smoothie':
      return fill('#7b3c8c', <><circle r={r} fill="url(#SMOOTHIE)" />{[0.5, 0.8].map((k, i) => <path key={i} d={`M${-r * k},0 C${-r * k / 2},${-r * k / 2} ${r * k / 2},${r * k / 2} ${r * k},0`} stroke="#a160b0" strokeWidth={3} fill="none" opacity={0.6} />)}</>);
    case 'soep':
      return fill('#cf4429', <><circle r={r} fill="url(#SOUP)" /><ellipse cx={-r * 0.3} cy={-r * 0.35} rx={r * 0.35} ry={r * 0.15} fill="#fff" opacity={0.12} /></>);
    case 'curry':
      return fill('#e59a35', <><circle r={r} fill="url(#CURRY)" />{Array.from({ length: 22 }, (_, i) => <circle key={i} cx={jitter(rng, r * 0.8)} cy={jitter(rng, r * 0.8)} r={1 + rng() * 2} fill="#d97b17" opacity={0.6} />)}</>);
    case 'dahl':
      return fill('#e8b23a', <><circle r={r} fill="url(#LENTIL-Y)" /><circle r={r} fill="url(#CURRY)" opacity={0.4} /></>);
    case 'chili':
      return fill('#8f2c1d', <>{Array.from({ length: 40 }, (_, i) => { const a = rng() * Math.PI * 2; const d = Math.sqrt(rng()) * r * 0.9; const kind = i % 4; return <g key={i} transform={`translate(${Math.cos(a) * d} ${Math.sin(a) * d}) rotate(${rng() * 360}) scale(0.55)`}>{kind === 0 ? drawItem('zwarte-boon', rng, '') : kind === 1 ? drawItem('kidneyboon', rng, '') : kind === 2 ? drawItem('mais', rng, '') : <circle r={5} fill="#b33a22" />}</g>; })}</>);
    case 'tomatensaus':
      return fill('#c23a22', <>{Array.from({ length: 30 }, (_, i) => <circle key={i} cx={jitter(rng, r * 0.85)} cy={jitter(rng, r * 0.85)} r={1.5 + rng() * 2.5} fill={i % 2 ? '#d9542f' : '#a82d1a'} opacity={0.7} />)}</>);
    case 'bolognese': {
      const strands: ReactNode[] = [];
      for (let i = 0; i < 46; i++) {
        const a = rng() * Math.PI * 2;
        const rr = r * (0.35 + rng() * 0.55);
        const sweep = 0.8 + rng() * 1.2;
        const x1 = Math.cos(a) * rr, y1 = Math.sin(a) * rr;
        const x2 = Math.cos(a + sweep) * rr * 0.9, y2 = Math.sin(a + sweep) * rr * 0.9;
        strands.push(<path key={i} d={`M${x1.toFixed(1)},${y1.toFixed(1)} A${rr},${rr} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)}`} stroke={i % 3 ? '#e9c268' : '#f3d68a'} strokeWidth={2.4} fill="none" strokeLinecap="round" />);
      }
      return <><circle r={r * 0.92} fill="#d9b25a" />{strands}<path d={blob(rng, r * 0.5, 11, 0.12)} fill="#b8341f" /><path d={blob(rng, r * 0.38, 9, 0.2)} fill="#cc4a2a" />{Array.from({ length: 22 }, (_, i) => <circle key={'m' + i} cx={jitter(rng, r * 0.36)} cy={jitter(rng, r * 0.36)} r={1.6 + rng() * 1.6} fill={i % 2 ? '#7a2c18' : '#93391f'} />)}</>;
    }
    case 'rijst':
      return fill('#f3f0e8', <circle r={r} fill="url(#RICE)" />);
    case 'quinoa':
      return fill('#efe1c0', <circle r={r} fill="url(#QUINOA)" />);
    case 'couscous':
    case 'bulgur':
      return fill(base === 'couscous' ? '#ecd294' : '#d8b878', <circle r={r} fill="url(#COUS)" />);
    case 'linzen':
      return fill('#7b6a3f', <circle r={r} fill="url(#LENTIL)" />);
    case 'salade':
    case 'spinazie': {
      const leaf = base === 'salade' ? 'sla' : 'spinazie';
      return <>{fill(base === 'salade' ? '#7cb53e' : '#2c5f27')}{Array.from({ length: 26 }, (_, i) => { const a = rng() * Math.PI * 2; const d = Math.sqrt(rng()) * r * 0.85; return <g key={i} transform={`translate(${Math.cos(a) * d} ${Math.sin(a) * d}) rotate(${rng() * 360}) scale(${1.5 + rng()})`}>{drawItem(leaf, rng, '')}</g>; })}</>;
    }
    case 'noedels': {
      const strands: ReactNode[] = [];
      for (let i = 0; i < 40; i++) {
        const y = jitter(rng, r * 0.8);
        const x0 = -Math.sqrt(Math.max(0, r * r - y * y)) * 0.9;
        strands.push(<path key={i} d={`M${x0},${y} C${x0 / 3},${y + jitter(rng, 20)} ${-x0 / 3},${y + jitter(rng, 20)} ${-x0},${y + jitter(rng, 10)}`} stroke={i % 3 ? '#e2b25a' : '#ecc679'} strokeWidth={2.6} fill="none" strokeLinecap="round" />);
      }
      return <><circle r={r * 0.95} fill="#c8913c" />{strands}</>;
    }
    case 'omelet':
      return <><path d={blob(rng, r * 0.86, 12, 0.05)} fill="#f2c94c" /><path d={blob(rng, r * 0.7, 12, 0.08)} fill="#f7d86b" />{Array.from({ length: 14 }, (_, i) => <circle key={i} cx={jitter(rng, r * 0.65)} cy={jitter(rng, r * 0.65)} r={2 + rng() * 3} fill="#d9a03c" opacity={0.35} />)}</>;
    case 'hummus':
      return fill('#e3c28a', <path d={`M0,0 m${-r * 0.6},0 a${r * 0.6},${r * 0.6} 0 1,1 ${r * 1.2},0 a${r * 0.4},${r * 0.4} 0 1,1 ${-r * 0.8},0`} fill="none" stroke="#cfa665" strokeWidth={4} />);
  }
  void onPlate;
}

/* ---------- ondergrond ---------- */
function drawBg(bg: Bg, rng: Rng, id: string): ReactNode {
  switch (bg) {
    case 'hout':
    case 'eiken': {
      const tones = bg === 'hout' ? ['#7a4b2c', '#87553a', '#6f4427', '#8d5b3a', '#7f4f30'] : ['#c99d6d', '#d3a878', '#bf9262', '#cfa271', '#c49866'];
      const grain = bg === 'hout' ? '#4e2f1a' : '#9c7246';
      const h = H / 5;
      return <>{tones.map((c, i) => <rect key={i} x={0} y={i * h} width={W} height={h} fill={c} />)}{Array.from({ length: 34 }, (_, i) => { const y = rng() * H; return <path key={'g' + i} d={`M0,${y} C${W * 0.3},${y + jitter(rng, 6)} ${W * 0.6},${y + jitter(rng, 6)} ${W},${y + jitter(rng, 4)}`} stroke={grain} strokeWidth={0.6 + rng()} opacity={0.18} fill="none" />; })}{tones.map((_, i) => <rect key={'l' + i} x={0} y={i * h - 1} width={W} height={2} fill="#000" opacity={0.25} />)}{[0, 1, 2].map((i) => <ellipse key={'k' + i} cx={rng() * W} cy={rng() * H} rx={6} ry={3} fill={grain} opacity={0.25} />)}</>;
    }
    case 'linnen':
      return <><rect width={W} height={H} fill="#ece5d8" /><rect width={W} height={H} fill={`url(#${id}-linen)`} /></>;
    case 'marmer':
      return <><rect width={W} height={H} fill="#f1efeb" /><g filter={`url(#${id}-soft)`}>{Array.from({ length: 7 }, (_, i) => { const y = rng() * H; return <path key={i} d={`M-10,${y} C${100 + jitter(rng, 60)},${y + jitter(rng, 80)} ${250 + jitter(rng, 60)},${y + jitter(rng, 80)} ${W + 10},${y + jitter(rng, 60)}`} stroke="#b9b6b0" strokeWidth={0.8 + rng() * 1.6} opacity={0.5} fill="none" />; })}</g></>;
    case 'leisteen':
      return <><rect width={W} height={H} fill="#2e3437" /><g filter={`url(#${id}-blur)`}>{Array.from({ length: 26 }, (_, i) => <circle key={i} cx={rng() * W} cy={rng() * H} r={10 + rng() * 40} fill={i % 2 ? '#394145' : '#262b2e'} opacity={0.6} />)}</g></>;
    case 'terrazzo':
      return <><rect width={W} height={H} fill="#ece6dd" />{Array.from({ length: 120 }, (_, i) => <path key={i} d={blob(rng, 1.5 + rng() * 3, 5, 0.35)} transform={`translate(${rng() * W} ${rng() * H})`} fill={pick(rng, ['#d9825e', '#8aa58a', '#b9b2a6', '#e5b07a', '#6d7c74'])} opacity={0.8} />)}</>;
  }
}

/* ---------- servies ---------- */
function Dish({ art, id, children, rng }: { art: Art; id: string; children: ReactNode; rng: Rng }) {
  const tint = art.tint ?? '#f4f1ea';
  switch (art.dish) {
    case 'kom':
      return (
        <g>
          <g filter={`url(#${id}-drop)`}><circle cx={200} cy={150} r={118} fill={tint} /></g>
          <circle cx={200} cy={150} r={118} fill={`url(#${id}-ceramic)`} />
          <circle cx={200} cy={150} r={104} fill="#000" opacity={0.08} />
          <circle cx={200} cy={150} r={101} fill={tint} />
          <circle cx={200} cy={150} r={101} fill={`url(#${id}-inner)`} />
          <g transform="translate(200 150)"><g clipPath={`url(#${id}-clip)`}>{children}</g></g>
          <circle cx={200} cy={150} r={95} fill={`url(#${id}-rimshade)`} pointerEvents="none" />
        </g>
      );
    case 'bord':
      return (
        <g>
          <g filter={`url(#${id}-drop)`}><circle cx={200} cy={150} r={134} fill={tint} /></g>
          <circle cx={200} cy={150} r={134} fill={`url(#${id}-ceramic)`} />
          <circle cx={200} cy={150} r={104} fill="#000" opacity={0.05} />
          <circle cx={200} cy={150} r={102} fill={tint} />
          <g transform="translate(200 150)">{children}</g>
        </g>
      );
    case 'pan':
      return (
        <g>
          <g filter={`url(#${id}-drop)`}>
            <rect x={290} y={138} width={120} height={24} rx={11} fill="#1f1f22" />
            <circle cx={186} cy={150} r={116} fill="#26272b" />
          </g>
          <circle cx={186} cy={150} r={116} fill={`url(#${id}-metal)`} />
          <circle cx={186} cy={150} r={103} fill="#18191c" />
          <g transform="translate(186 150)"><g clipPath={`url(#${id}-clip)`}>{children}</g></g>
          <circle cx={186} cy={150} r={103} fill={`url(#${id}-rimshade)`} pointerEvents="none" />
        </g>
      );
    case 'plank':
      return (
        <g>
          <g filter={`url(#${id}-drop)`}><rect x={46} y={52} width={308} height={196} rx={26} fill="#c08a52" /></g>
          <rect x={46} y={52} width={308} height={196} rx={26} fill={`url(#${id}-board)`} />
          {Array.from({ length: 14 }, (_, i) => { const y = 60 + rng() * 180; return <path key={i} d={`M52,${y} C150,${y + jitter(rng, 5)} 250,${y + jitter(rng, 5)} 348,${y + jitter(rng, 3)}`} stroke="#8a5a2c" strokeWidth={0.7} opacity={0.22} fill="none" />; })}
          <rect x={46} y={52} width={308} height={196} rx={26} fill="none" stroke="#9a6838" strokeWidth={2} opacity={0.5} />
          <g transform="translate(200 150)">{children}</g>
        </g>
      );
    case 'pot':
    case 'glas': {
      const layers = art.layers ?? [];
      const total = layers.reduce((s, l) => s + l[1], 0);
      const bottom = 262, top = 82, hh = bottom - top;
      let y = bottom;
      return (
        <g>
          <ellipse cx={200} cy={266} rx={78} ry={14} fill="#000" opacity={0.25} filter={`url(#${id}-blur)`} />
          <path d="M140,72 L140,250 Q140,268 160,268 L240,268 Q260,268 260,250 L260,72Z" fill="#fff" opacity={0.18} />
          <g clipPath={`url(#${id}-jar)`}>
            {layers.map(([c, h], i) => {
              const lh = (h / total) * hh;
              y -= lh;
              const wave = `M140,${y + lh + 1} L140,${y + 3} ${Array.from({ length: 6 }, (_, k) => `Q${150 + k * 20},${y + (k % 2 ? 6 : -3)} ${160 + k * 20},${y + 2}`).join(' ')} L260,${y + 2} L260,${y + lh + 1}Z`;
              return <path key={i} d={wave} fill={c} />;
            })}
            <ellipse cx={200} cy={top} rx={60} ry={14} fill={layers[layers.length - 1]?.[0] ?? '#eee'} />
            <ellipse cx={200} cy={top} rx={60} ry={14} fill={`url(#${id}-topshade)`} />
            <g transform={`translate(200 ${top})`}>{children}</g>
            <rect x={140} y={60} width={16} height={210} fill="#fff" opacity={0.25} />
            <rect x={238} y={60} width={8} height={210} fill="#fff" opacity={0.15} />
          </g>
          <path d="M140,72 L140,250 Q140,268 160,268 L240,268 Q260,268 260,250 L260,72" fill="none" stroke="#fff" strokeWidth={3} opacity={0.55} />
          <ellipse cx={200} cy={72} rx={62} ry={14} fill="none" stroke="#fff" strokeWidth={3} opacity={0.6} />
        </g>
      );
    }
  }
}

function Props({ art }: { art: Art }) {
  if (art.dish === 'kom') {
    // lepel rechtsonder
    return <g opacity={0.95} transform="rotate(-28 340 230)"><ellipse cx={340} cy={218} rx={13} ry={18} fill="#c9ccd1" /><ellipse cx={338} cy={214} rx={6} ry={10} fill="#eef0f3" opacity={0.7} /><rect x={336} y={234} width={8} height={90} rx={4} fill="#b9bcc2" /></g>;
  }
  if (art.dish === 'bord') {
    // vork links
    return <g transform="rotate(8 40 150)"><rect x={28} y={150} width={8} height={160} rx={4} fill="#b9bcc2" />{[0, 1, 2, 3].map((i) => <rect key={i} x={24 + i * 4.5} y={88} width={2.6} height={44} rx={1.3} fill="#c9ccd1" />)}<rect x={23} y={126} width={18} height={30} rx={8} fill="#c4c7cc" /></g>;
  }
  return null;
}

function placeParts(parts: Part[], f: Frame, rng: Rng, id: string, absolute: boolean, offset = { x: 0, y: 0 }) {
  const out: ReactNode[] = [];
  parts.forEach(([k, n, x, y, rad, size = 10], pi) => {
    const cx = absolute ? W / 2 + x * (W / 2) : x * f.rx + offset.x;
    const cy = absolute ? H / 2 + y * (H / 2) : y * f.ry + offset.y;
    const rx = absolute ? rad * (W / 2) : rad * f.rx;
    const ry = absolute ? rad * (H / 2) : rad * f.ry;
    const drizzle = DRIZZLE[k];
    if (drizzle) {
      const pts = Array.from({ length: 7 }, (_, i) => [cx - rx * 0.9 + (i / 6) * rx * 1.8 + jitter(rng, rx * 0.06), cy + (i % 2 ? -1 : 1) * ry * 0.55 + jitter(rng, ry * 0.2)]);
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
        d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
      }
      out.push(<g key={pi} opacity={0.9}><path d={d} stroke={drizzle[0]} strokeWidth={drizzle[1] * 0.8} fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={d} stroke="#fff" strokeWidth={0.8} opacity={0.35} fill="none" transform="translate(-0.6 -0.6)" /></g>);
      return;
    }
    const sprinkle = SPRINKLE.has(k);
    // kleine ingrediënten iets groter, zodat ze op een telefoonscherm goed leesbaar zijn
    const sz = !sprinkle && size <= 30 ? size * 1.3 : size;
    const pts = scatter(rng, n, cx, cy, rx, ry, sprinkle ? 0 : sz * 1.4);
    const scale = sprinkle ? (size === 10 ? 1.3 : (size / 5) * 1.2) : sz / 10;
    out.push(
      <g key={pi}>
        {pts.map(([px, py], i) => (
          <g key={i} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(rng() * 360).toFixed(0)}) scale(${scale.toFixed(2)})`}>{drawItem(k, rng, id)}</g>
        ))}
      </g>,
    );
  });
  return out;
}

function Defs({ id, art }: { id: string; art: Art }) {
  const tint = art.tint ?? '#f4f1ea';
  return (
    <defs>
      <filter id={`${id}-drop`} x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="3" dy="9" stdDeviation="8" floodColor="#1b120a" floodOpacity="0.35" /></filter>
      <filter id={`${id}-item`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0.8" dy="1.6" stdDeviation="1.2" floodColor="#2a1a0c" floodOpacity="0.35" /></filter>
      <filter id={`${id}-blur`}><feGaussianBlur stdDeviation="6" /></filter>
      <filter id={`${id}-soft`}><feGaussianBlur stdDeviation="1.2" /></filter>
      <clipPath id={`${id}-clip`}><circle r={art.dish === 'pan' ? 103 : 101} /></clipPath>
      <clipPath id={`${id}-jar`}><path d="M140,72 L140,250 Q140,268 160,268 L240,268 Q260,268 260,250 L260,72Z" /></clipPath>
      <radialGradient id={`${id}-ceramic`} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.18" /></radialGradient>
      <radialGradient id={`${id}-inner`} cx="0.5" cy="0.5" r="0.5"><stop offset="0.8" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.2" /></radialGradient>
      <radialGradient id={`${id}-rimshade`} cx="0.55" cy="0.6" r="0.55"><stop offset="0.82" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.28" /></radialGradient>
      <radialGradient id={`${id}-metal`} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#5a5c62" /><stop offset="0.7" stopColor="#2b2c30" /><stop offset="1" stopColor="#141417" /></radialGradient>
      <radialGradient id={`${id}-topshade`} cx="0.4" cy="0.3" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.2" /><stop offset="1" stopColor="#000" stopOpacity="0.12" /></radialGradient>
      <linearGradient id={`${id}-board`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d6a56d" /><stop offset="1" stopColor="#b47c45" /></linearGradient>
      <radialGradient id={`${id}-bes`} cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#5a69c2" /><stop offset="1" stopColor="#1d2252" /></radialGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff6e0" stopOpacity="0.28" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.12" /></linearGradient>
      <radialGradient id={`${id}-vignette`} cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" /></radialGradient>
      <pattern id={`${id}-linen`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,0.5 H6 M0.5,0 V6" stroke="#d6cdbd" strokeWidth="0.8" opacity="0.7" /></pattern>
      {/* gedeelde verlopen voor ingrediënten: zonder id-prefix maar per svg opnieuw gedefinieerd */}
      <radialGradient id="YOLK" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#ffd34d" /><stop offset="1" stopColor="#f08f0c" /></radialGradient>
      <linearGradient id="GLAZE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8541f" stopOpacity="0.55" /><stop offset="0.6" stopColor="#b8541f" stopOpacity="0" /></linearGradient>
      <radialGradient id="PANCAKE" cx="0.45" cy="0.4" r="0.65"><stop offset="0" stopColor="#f0c27a" /><stop offset="0.8" stopColor="#d69445" /><stop offset="1" stopColor="#bf7a33" /></radialGradient>
      <radialGradient id="CREAM" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="1" stopColor="#d8d0bc" stopOpacity="0.3" /></radialGradient>
      <radialGradient id="SMOOTHIE" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#9a55ab" /><stop offset="1" stopColor="#5f2a70" /></radialGradient>
      <radialGradient id="SOUP" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#e8613a" /><stop offset="1" stopColor="#b2321e" /></radialGradient>
      <radialGradient id="CURRY" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#f2b44a" /><stop offset="1" stopColor="#d08325" /></radialGradient>
      <pattern id="RICE" width="16" height="14" patternUnits="userSpaceOnUse">{[[3, 3, 20], [10, 2, -30], [6, 8, 70], [13, 9, 10], [1, 11, -50], [9, 12, 40]].map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx={2.4} ry={1.1} fill={i % 2 ? '#fffefa' : '#ebe6d8'} transform={`rotate(${a} ${x} ${y})`} />)}</pattern>
      <pattern id="QUINOA" width="10" height="10" patternUnits="userSpaceOnUse">{[[2, 2], [7, 3], [4, 7], [9, 8], [1, 9]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={1.4} fill={i % 2 ? '#f5e6c4' : '#e3cf9f'} /><circle cx={x} cy={y} r={1.4} fill="none" stroke="#c9ad6f" strokeWidth={0.4} /></g>)}</pattern>
      <pattern id="COUS" width="8" height="8" patternUnits="userSpaceOnUse">{[[1, 1], [4, 2], [7, 1], [2, 5], [6, 5], [4, 7]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9} fill={i % 2 ? '#f6dfa0' : '#d7b46a'} />)}</pattern>
      <pattern id="LENTIL" width="10" height="10" patternUnits="userSpaceOnUse">{[[2, 2], [7, 2], [4, 6], [9, 7], [1, 8]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={2} ry={1.5} fill={i % 2 ? '#8d7b4a' : '#6b5a33'} />)}</pattern>
      <pattern id="LENTIL-Y" width="9" height="9" patternUnits="userSpaceOnUse">{[[2, 2], [6, 3], [4, 7], [8, 7]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={1.8} ry={1.3} fill={i % 2 ? '#f3c552' : '#dba12e'} />)}</pattern>
      <pattern id="OATS" width="12" height="12" patternUnits="userSpaceOnUse">{[[3, 3, 20], [9, 4, -40], [5, 9, 60], [11, 10, 0]].map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx={3} ry={1.8} fill={i % 2 ? '#efdcb4' : '#d6bd8c'} transform={`rotate(${a} ${x} ${y})`} />)}</pattern>
      <clipPath id={`${id}-all`}><rect width={W} height={H} /></clipPath>
      <rect id={`${id}-tint`} width="1" height="1" fill={tint} />
    </defs>
  );
}

function ArtSvg({ recipe }: { recipe: Recipe }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `a${uid}`;
  const art = recipe.art;
  const rng = rngFor(recipe.id);
  const f = frameFor(art);
  const round = art.dish === 'kom' || art.dish === 'bord' || art.dish === 'pan';
  const contentR = art.dish === 'pan' ? 103 : 101;
  const bg = drawBg(art.bg, rng, id);
  const base = art.base && round ? drawBase(art.base, art.dish === 'bord' ? 82 : contentR, rng, art.dish === 'bord') : null;
  const parts = placeParts(art.parts, f, rng, id, false, art.dish === 'pot' || art.dish === 'glas' ? { x: 0, y: 0 } : { x: 0, y: 0 });
  const side = art.side ? placeParts(art.side, f, rng, id, true) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={recipe.name} className="foodart">
      <Defs id={id} art={art} />
      <g clipPath={`url(#${id}-all)`}>
        {bg}
        <Props art={art} />
        <Dish art={art} id={id} rng={rng}>
          {base && art.dish === 'bord' ? <g filter={`url(#${id}-item)`}>{base}</g> : base}
          <g filter={`url(#${id}-item)`}>{parts}</g>
        </Dish>
        {side && <g filter={`url(#${id}-item)`}>{side}</g>}
        <rect width={W} height={H} fill={`url(#${id}-light)`} />
        <rect width={W} height={H} fill={`url(#${id}-vignette)`} />
      </g>
    </svg>
  );
}

/** Foto van een recept: een echte foto als die er is, anders de getekende versie. */
export const FoodArt = memo(function FoodArt({ recipe, className = '' }: { recipe: Recipe; className?: string }) {
  return (
    <div className={'foodphoto ' + className}>
      {recipe.photo ? <img src={recipe.photo} alt={recipe.name} loading="lazy" /> : <ArtSvg recipe={recipe} />}
    </div>
  );
});
