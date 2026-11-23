// Canvas helpers shared by arena + ghost games: sizing, world scaling, Bloop sprites, labels.
import type { Avatar } from '@shared/types';
import { avatarImage, bodyColor } from '../components/avatarSvg';

export interface Viewport {
  scale: number;
  ox: number;
  oy: number;
  cssW: number;
  cssH: number;
  dpr: number;
}

/** Fit a world of w*h into the canvas (letterboxed), returns transform info. */
export function fitWorld(cv: HTMLCanvasElement, w: number, h: number, pad = 8): Viewport {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const parent = cv.parentElement!;
  const cssW = parent.clientWidth;
  const cssH = parent.clientHeight;
  if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;
  }
  const scale = Math.min((cssW - pad * 2) / w, (cssH - pad * 2) / h);
  const ox = (cssW - w * scale) / 2;
  const oy = (cssH - h * scale) / 2;
  return { scale, ox, oy, cssW, cssH, dpr };
}

export function applyView(ctx: CanvasRenderingContext2D, v: Viewport): void {
  ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.ox, v.dpr * v.oy);
}

/** Screen (client) coords -> world coords. */
export function toWorld(v: Viewport, cv: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = cv.getBoundingClientRect();
  return { x: (clientX - r.left - v.ox) / v.scale, y: (clientY - r.top - v.oy) / v.scale };
}

export interface BloopOpts {
  name?: string;
  me?: boolean;
  alpha?: number;
  mood?: 'normal' | 'sad' | 'shock' | 'happy';
  ring?: string;
  flip?: boolean;
  squash?: number;
  label?: string;
}

/** Draw a player's Bloop centred at x,y with body radius r (world units). */
export function drawBloop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, avatar: Avatar | undefined, o: BloopOpts = {}): void {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.ring) {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 1.25, 0, Math.PI * 2);
    ctx.strokeStyle = o.ring;
    ctx.lineWidth = Math.max(3, r * 0.18);
    ctx.stroke();
  }
  if (o.me) {
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.95, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }
  if (avatar) {
    const img = avatarImage(avatar, o.mood);
    const w = r * 2.35;
    const h = w * 1.18;
    const sq = o.squash ?? 1;
    if (img.complete && img.naturalWidth) {
      ctx.translate(x, y);
      if (o.flip) ctx.scale(-1, 1);
      ctx.scale(1 / sq, sq);
      ctx.drawImage(img, -w / 2, -h * 0.6, w, h);
      ctx.setTransform(ctx.getTransform());
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor(avatar);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ccc';
    ctx.fill();
  }
  ctx.restore();
  if (o.name || o.label) {
    const text = o.label ?? o.name!;
    ctx.save();
    ctx.font = `700 ${Math.max(12, r * 0.55)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const ty = y - r * 1.55;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,8,50,0.75)';
    ctx.strokeText(text, x, ty);
    ctx.fillStyle = o.me ? '#FFE45C' : '#fff';
    ctx.fillText(text, x, ty);
    ctx.restore();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', weight = 800): void {
  ctx.save();
  ctx.font = `${weight} ${size}px Fredoka, Nunito, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = 'rgba(20,8,50,0.7)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

export function emoji(ctx: CanvasRenderingContext2D, e: string, x: number, y: number, size: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e, 0, size * 0.05);
  ctx.restore();
}
