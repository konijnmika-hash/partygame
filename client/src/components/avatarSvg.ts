// Original "Bloop" character art, generated as SVG markup from validated cosmetic ids.
// Only catalog constants end up in the markup (ids are looked up, never interpolated raw).
import type { Avatar } from '@shared/types';
import { COSMETIC_MAP } from '@shared/cosmetics';

const INK = '#2a1a4f';
const BODY = 'M50 20C76 20 91 40 91 62C91 84 73 94 50 94C27 94 9 84 9 62C9 40 24 20 50 20Z';

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt)); g = Math.round(g * (1 + amt)); b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
  }
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function safeColor(id: string): { base: string; stops: string[] } {
  const c = COSMETIC_MAP[id];
  const base = c && c.kind === 'color' && c.value && /^#[0-9a-fA-F]{6}$/.test(c.value) ? c.value : '#FF5FA2';
  const stops = c?.gradient?.filter((s) => /^#[0-9a-fA-F]{6}$/.test(s)) ?? [];
  return { base, stops };
}

const EYES: Record<string, string> = {
  'e-round': `<ellipse cx="37" cy="55" rx="8" ry="10" fill="#fff"/><ellipse cx="63" cy="55" rx="8" ry="10" fill="#fff"/><circle cx="38" cy="57.5" r="4.6" fill="${INK}"/><circle cx="64" cy="57.5" r="4.6" fill="${INK}"/><circle cx="39.6" cy="55.6" r="1.6" fill="#fff"/><circle cx="65.6" cy="55.6" r="1.6" fill="#fff"/>`,
  'e-happy': `<path d="M29 58Q37 48 45 58M55 58Q63 48 71 58" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
  'e-wink': `<ellipse cx="37" cy="55" rx="8" ry="10" fill="#fff"/><circle cx="38" cy="57.5" r="4.6" fill="${INK}"/><circle cx="39.6" cy="55.6" r="1.6" fill="#fff"/><path d="M55 57Q63 49 71 57" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
  'e-sleepy': `<ellipse cx="37" cy="56" rx="8" ry="8" fill="#fff"/><ellipse cx="63" cy="56" rx="8" ry="8" fill="#fff"/><circle cx="37" cy="59" r="4" fill="${INK}"/><circle cx="63" cy="59" r="4" fill="${INK}"/><path d="M28 55H46M54 55H72" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M29 55Q37 46 45 55ZM55 55Q63 46 71 55Z" fill="BODYC"/>`,
  'e-angry': `<ellipse cx="37" cy="57" rx="7.5" ry="8.5" fill="#fff"/><ellipse cx="63" cy="57" rx="7.5" ry="8.5" fill="#fff"/><circle cx="38" cy="59" r="4.3" fill="${INK}"/><circle cx="62" cy="59" r="4.3" fill="${INK}"/><path d="M27 44L45 51M73 44L55 51" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`,
  'e-star': `<path d="M37 45l3 7 7.5.6-5.8 4.8 1.9 7.4L37 60.6l-6.6 4.2 1.9-7.4-5.8-4.8 7.5-.6z" fill="#FFE14D" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M63 45l3 7 7.5.6-5.8 4.8 1.9 7.4L63 60.6l-6.6 4.2 1.9-7.4-5.8-4.8 7.5-.6z" fill="#FFE14D" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  'e-dizzy': `<path d="M31 49l12 12M43 49L31 61M57 49l12 12M69 49L57 61" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`,
  'e-shades': `<path d="M24 50h22a3 3 0 0 1 3 3v3c0 6-5 10-11 10h-2c-7 0-12-5-12-12v-1a3 3 0 0 1 3-3zM54 50h22a3 3 0 0 1 3 3v1c0 7-5 12-12 12h-2c-6 0-11-4-11-10v-3a3 3 0 0 1 3-3z" fill="#111"/><path d="M46 53h8" stroke="#111" stroke-width="4"/><path d="M28 54l6 0M58 54l6 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`,
  'e-cyclops': `<ellipse cx="50" cy="54" rx="14" ry="15" fill="#fff"/><circle cx="51" cy="57" r="7.5" fill="${INK}"/><circle cx="54" cy="53" r="2.6" fill="#fff"/>`,
  'e-sparkle': `<ellipse cx="37" cy="55" rx="9" ry="11" fill="${INK}"/><ellipse cx="63" cy="55" rx="9" ry="11" fill="${INK}"/><circle cx="40" cy="51" r="3.6" fill="#fff"/><circle cx="66" cy="51" r="3.6" fill="#fff"/><circle cx="34.5" cy="59.5" r="1.8" fill="#fff"/><circle cx="60.5" cy="59.5" r="1.8" fill="#fff"/>`,
  'e-robot': `<rect x="27" y="49" width="20" height="12" rx="3" fill="${INK}"/><rect x="53" y="49" width="20" height="12" rx="3" fill="${INK}"/><rect x="30" y="52" width="14" height="6" rx="2" fill="#4DF3FF"/><rect x="56" y="52" width="14" height="6" rx="2" fill="#4DF3FF"/>`,
  'e-heart': `<path d="M37 64s-10-6-10-12.5c0-3.3 2.6-5.5 5.4-5.5 2 0 3.6 1.2 4.6 2.8 1-1.6 2.6-2.8 4.6-2.8 2.8 0 5.4 2.2 5.4 5.5C47 58 37 64 37 64z" fill="#FF3B6B" stroke="${INK}" stroke-width="2"/><path d="M63 64s-10-6-10-12.5c0-3.3 2.6-5.5 5.4-5.5 2 0 3.6 1.2 4.6 2.8 1-1.6 2.6-2.8 4.6-2.8 2.8 0 5.4 2.2 5.4 5.5C73 58 63 64 63 64z" fill="#FF3B6B" stroke="${INK}" stroke-width="2"/>`,
};

const MOUTHS: Record<string, string> = {
  'm-smile': `<path d="M41 70Q50 79 59 70" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  'm-grin': `<path d="M37 68Q50 86 63 68Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M40 69.5H60" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  'm-open': `<path d="M40 68Q50 88 60 68Z" fill="${INK}"/><path d="M44 77Q50 73 56 77Q53 82 50 82Q47 82 44 77Z" fill="#FF7A9A"/>`,
  'm-tongue': `<path d="M41 70Q50 77 59 70" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M47 73h8v5a4 4 0 0 1-8 0z" fill="#FF6F91" stroke="${INK}" stroke-width="2.5"/>`,
  'm-o': `<ellipse cx="50" cy="74" rx="5" ry="6" fill="${INK}"/>`,
  'm-fang': `<path d="M40 70Q50 79 60 70" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M53 74l2.5 5 2.5-5.8z" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`,
  'm-cat': `<path d="M40 70Q45 76 50 70Q55 76 60 70" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  'm-teeth': `<rect x="36" y="67" width="28" height="12" rx="5" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M43 67v12M50 67v12M57 67v12M36 73h28" stroke="${INK}" stroke-width="2"/>`,
  'm-zigzag': `<path d="M38 73l4-4 4 4 4-4 4 4 4-4 4 4" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  'm-mustache': `<path d="M43 76Q50 81 57 76" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M50 69c-4-4-12-4-15 2 3-1 6 1 8 2 3 1 5 0 7-2 2 2 4 3 7 2 2-1 5-3 8-2-3-6-11-6-15-2z" fill="#6B3E1F"/>`,
  'm-smirk': `<path d="M40 72Q52 76 61 67" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  'm-kiss': `<path d="M50 79c-6-3-8-6-6-8.5 1.5-1.8 4-1.4 6 .5 2-1.9 4.5-2.3 6-.5 2 2.5 0 5.5-6 8.5z" fill="#FF3B6B" stroke="${INK}" stroke-width="2"/>`,
};

const ACC_BEHIND: Record<string, string> = {
  'a-wings': `<path d="M12 58C-6 44-8 66 4 72c-6 4 0 12 10 6z" fill="#fff" stroke="#c9c2ec" stroke-width="2.5"/><path d="M88 58c18-14 20 8 8 14 6 4 0 12-10 6z" fill="#fff" stroke="#c9c2ec" stroke-width="2.5"/>`,
};

const ACC_MASK: Record<string, string> = {
  'a-mask': `<path d="M20 50Q50 42 80 50L82 62Q50 66 18 62Z" fill="#E8304A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
};

const ACC_FRONT: Record<string, string> = {
  'a-none': '',
  'a-blush': `<ellipse cx="25" cy="67" rx="6.5" ry="4" fill="#FF6F9C" opacity=".55"/><ellipse cx="75" cy="67" rx="6.5" ry="4" fill="#FF6F9C" opacity=".55"/>`,
  'a-bowtie': `<path d="M50 88l-12-7v14zM50 88l12-7v14z" fill="#E8304A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="88" r="3.4" fill="#B71C34" stroke="${INK}" stroke-width="2"/>`,
  'a-glasses': `<circle cx="37" cy="56" r="11" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="63" cy="56" r="11" fill="none" stroke="${INK}" stroke-width="3"/><path d="M48 55h4M26 54l-12-3M74 54l12-3" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  'a-scarf': `<path d="M18 80Q50 92 82 80L84 88Q50 100 16 88Z" fill="#3DA9FC" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M66 88l4 14 8-3-4-13z" fill="#3DA9FC" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 84l2 4M42 87l1 4M56 87l-1 4" stroke="#fff" stroke-width="2" opacity=".7"/>`,
  'a-monocle': `<circle cx="63" cy="56" r="11" fill="rgba(255,255,255,.15)" stroke="#D4A017" stroke-width="3"/><path d="M73 62q6 10 2 22" stroke="#D4A017" stroke-width="2" fill="none"/>`,
  'a-bandana': `<path d="M22 82Q50 94 78 82L50 100Z" fill="#E8304A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="44" cy="89" r="1.6" fill="#fff"/><circle cx="54" cy="91" r="1.6" fill="#fff"/><circle cx="50" cy="95" r="1.4" fill="#fff"/>`,
  'a-necklace': `${[22, 30, 38, 46, 54, 62, 70, 78].map((x, i) => `<circle cx="${x}" cy="${84 + Math.round(Math.sin((i / 7) * Math.PI) * 6)}" r="3.4" fill="#fff" stroke="#c9c2ec" stroke-width="1.4"/>`).join('')}`,
  'a-mask': '',
  'a-tie': `<path d="M46 82h8l-1.5 4 4 13L50 104l-6.5-5 4-13z" fill="#3F6BFF" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
  'a-wings': '',
  'a-badge': `<path d="M72 74l2.8 5.6 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2-4.5-4.4 6.2-.9z" fill="#FFD23F" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  'a-medal': `<path d="M42 78l8 12 8-12" stroke="#3F6BFF" stroke-width="5" fill="none"/><circle cx="50" cy="94" r="7" fill="#FFC531" stroke="${INK}" stroke-width="2.5"/><path d="M50 90.5v7M47 92l3-1.5" stroke="#B8860B" stroke-width="2" stroke-linecap="round"/>`,
};

const HATS: Record<string, string> = {
  'h-none': '',
  'h-party': `<path d="M36 26L50 -6L64 26Z" fill="#FFD23F" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M41 14l15 5M44 6l10 4M38.5 21l19 4" stroke="#FF4F9A" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="-7" r="5" fill="#FF4F9A" stroke="${INK}" stroke-width="2.5"/>`,
  'h-beanie': `<path d="M24 32Q24 6 50 6Q76 6 76 32Z" fill="#7B5CFF" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="21" y="26" width="58" height="10" rx="5" fill="#5233DF" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="4" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`,
  'h-propeller': `<path d="M28 28Q28 8 50 8Q72 8 72 28Z" fill="#FF5A5F" stroke="${INK}" stroke-width="3"/><path d="M50 8V-2" stroke="${INK}" stroke-width="3"/><path d="M50 -3C42 -8 30 -6 30 -3S42 2 50 -3C58 -8 70 -6 70 -3S58 2 50 -3Z" fill="#3DA9FC" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="-3" r="3" fill="#FFD23F" stroke="${INK}" stroke-width="2"/>`,
  'h-cap': `<path d="M26 30Q26 8 50 8Q72 8 74 30Z" fill="#3DA9FC" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M60 28Q84 24 96 32Q82 36 62 34Z" fill="#1B7FD0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="9" r="3" fill="#1B7FD0"/>`,
  'h-flower': `<g transform="translate(70 22)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-8" rx="5" ry="8" fill="#FF8FC7" stroke="${INK}" stroke-width="2" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#FFD23F" stroke="${INK}" stroke-width="2"/></g>`,
  'h-sprout': `<path d="M50 22C50 14 50 8 51 2" stroke="#2FA84F" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M51 6C40 -4 30 4 34 8C40 12 48 10 51 6ZM51 4C60 -8 72 -2 68 4C63 9 54 8 51 4Z" fill="#5BD15B" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
  'h-bunny': `<path d="M34 26C24 6 28 -22 36 -22S46 4 44 24Z" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M36 18C32 6 33 -12 36 -14S41 4 40 18Z" fill="#FFB3D1"/><path d="M66 26C76 6 72 -22 64 -22S54 4 56 24Z" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M64 18C68 6 67 -12 64 -14S59 4 60 18Z" fill="#FFB3D1"/>`,
  'h-cat': `<path d="M22 36L24 8L44 22Z" fill="BODYC" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M78 36L76 8L56 22Z" fill="BODYC" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M27 28l1-12 9 7zM73 28l-1-12-9 7z" fill="#FFB3D1"/>`,
  'h-chef': `<path d="M32 28V14C22 14 20 0 30 -2C30 -12 44 -14 48 -6C52 -14 68 -12 68 -2C80 -2 78 14 68 14V28Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M32 22H68" stroke="#d9d2f5" stroke-width="3"/>`,
  'h-cowboy': `<path d="M8 28Q50 40 92 28Q86 20 74 24Q72 0 50 4Q28 0 26 24Q14 20 8 28Z" fill="#B86B2C" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M28 20Q50 26 72 20" stroke="#6B3E1F" stroke-width="4" fill="none"/>`,
  'h-tophat': `<rect x="32" y="-14" width="36" height="36" rx="4" fill="#26223a" stroke="${INK}" stroke-width="3"/><rect x="32" y="10" width="36" height="7" fill="#FF4F9A"/><path d="M20 24Q50 30 80 24L80 28Q50 34 20 28Z" fill="#26223a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  'h-pirate': `<path d="M12 28Q30 0 50 4Q70 0 88 28Q70 18 50 22Q30 18 12 28Z" fill="#26223a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="13" r="4" fill="#fff"/><path d="M45 19l10-4M45 15l10 4" stroke="#fff" stroke-width="1.6"/>`,
  'h-wizard': `<path d="M28 28L48 -20Q54 -24 58 -16L72 28Z" fill="#5233DF" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M20 28Q50 36 80 28" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M20 28Q50 36 80 28" stroke="#7B5CFF" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M47 4l1.5 3 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4zM58 14l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="#FFD23F"/>`,
  'h-viking': `<path d="M24 30Q24 6 50 6Q76 6 76 30Z" fill="#B0B8CC" stroke="${INK}" stroke-width="3"/><path d="M24 28H76" stroke="${INK}" stroke-width="3"/><path d="M26 20C12 18 8 6 12 -4C14 6 20 10 28 12Z" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M74 20C88 18 92 6 88 -4C86 6 80 10 72 12Z" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="38" cy="22" r="2" fill="${INK}"/><circle cx="50" cy="22" r="2" fill="${INK}"/><circle cx="62" cy="22" r="2" fill="${INK}"/>`,
  'h-headphones': `<path d="M14 56C10 20 90 20 86 56" stroke="${INK}" stroke-width="5" fill="none"/><path d="M14 56C10 20 90 20 86 56" stroke="#FF4F9A" stroke-width="2.5" fill="none"/><rect x="2" y="48" width="14" height="22" rx="6" fill="#FF4F9A" stroke="${INK}" stroke-width="3"/><rect x="84" y="48" width="14" height="22" rx="6" fill="#FF4F9A" stroke="${INK}" stroke-width="3"/>`,
  'h-unicorn': `<path d="M44 22L52 -14L58 22Z" fill="#FFE27A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M46 14l10-3M48 6l8-2M50 -2l5-1" stroke="#E0A800" stroke-width="2" stroke-linecap="round"/><path d="M26 30Q32 12 44 20" stroke="#FF8FC7" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M28 34Q30 20 40 24" stroke="#9B6BFF" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  'h-astro': `<circle cx="50" cy="58" r="46" fill="rgba(190,230,255,.18)" stroke="#dff4ff" stroke-width="3"/><path d="M24 34Q34 22 48 20" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>`,
  'h-cone': `<path d="M34 26L46 -10H54L66 26Z" fill="#FF8A3D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M41.5 4h17M38.5 14h23" stroke="#fff" stroke-width="5"/><rect x="28" y="22" width="44" height="7" rx="3" fill="#FF8A3D" stroke="${INK}" stroke-width="3"/>`,
  'h-halo': `<ellipse cx="50" cy="4" rx="22" ry="6" fill="none" stroke="#FFD23F" stroke-width="5"/><ellipse cx="50" cy="4" rx="22" ry="6" fill="none" stroke="#fff6b0" stroke-width="1.5"/>`,
  'h-crown': `<path d="M28 28L26 2L38 14L50 -4L62 14L74 2L72 28Z" fill="#FFC531" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="18" r="4" fill="#FF3B6B" stroke="${INK}" stroke-width="2"/><circle cx="36" cy="21" r="3" fill="#3DA9FC" stroke="${INK}" stroke-width="1.8"/><circle cx="64" cy="21" r="3" fill="#36D07A" stroke="${INK}" stroke-width="1.8"/>`,
};

export interface AvatarRenderOpts {
  /** override mouth (e.g. sad face when eliminated) */
  mood?: 'normal' | 'sad' | 'shock' | 'happy';
  shadow?: boolean;
}

const cache = new Map<string, string>();

export function avatarSvg(a: Avatar, opts: AvatarRenderOpts = {}): string {
  const key = `${a.color}|${a.eyes}|${a.mouth}|${a.hat}|${a.acc}|${opts.mood || ''}|${opts.shadow ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { base, stops } = safeColor(a.color);
  const gid = 'g' + Math.abs(hashKey(key)).toString(36);
  const light = shade(base, 0.35);
  const dark = shade(base, -0.32);
  const gradStops = stops.length >= 2
    ? stops.map((s, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')
    : `<stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${shade(base, -0.12)}"/>`;
  const fill = `url(#${gid})`;
  const eyes = (EYES[a.eyes] ?? EYES['e-round']).replace(/BODYC/g, base);
  let mouth = MOUTHS[a.mouth] ?? MOUTHS['m-smile'];
  if (opts.mood === 'sad') mouth = `<path d="M41 76Q50 68 59 76" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if (opts.mood === 'shock') mouth = MOUTHS['m-o'];
  if (opts.mood === 'happy') mouth = MOUTHS['m-open'];
  const hat = (HATS[a.hat] ?? '').replace(/BODYC/g, base);
  const behind = ACC_BEHIND[a.acc] ?? '';
  const mask = ACC_MASK[a.acc] ?? '';
  const front = ACC_FRONT[a.acc] ?? '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -26 112 132" aria-hidden="true">` +
    `<defs><linearGradient id="${gid}" x1="0.15" y1="0" x2="0.85" y2="1">${gradStops}</linearGradient></defs>` +
    (opts.shadow ? `<ellipse cx="50" cy="98" rx="30" ry="5" fill="rgba(0,0,0,.22)"/>` : '') +
    behind +
    `<path d="${BODY}" fill="${fill}" stroke="${dark}" stroke-width="3.5"/>` +
    `<ellipse cx="33" cy="35" rx="11" ry="6" fill="#fff" opacity=".42" transform="rotate(-28 33 35)"/>` +
    mask + eyes + mouth + front + hat +
    `</svg>`;
  cache.set(key, svg);
  return svg;
}

function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const imgCache = new Map<string, HTMLImageElement>();

/** Avatar as an <img> for canvas games (cached). */
export function avatarImage(a: Avatar, mood?: AvatarRenderOpts['mood']): HTMLImageElement {
  const key = JSON.stringify(a) + (mood || '');
  let img = imgCache.get(key);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg(a, { mood }));
    imgCache.set(key, img);
  }
  return img;
}

export function bodyColor(a: Avatar): string {
  return safeColor(a.color).base;
}
