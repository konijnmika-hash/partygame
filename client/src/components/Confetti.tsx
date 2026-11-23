import { useEffect, useRef } from 'react';

const COLORS = ['#FF4F9A', '#FFD23F', '#2DE2E6', '#7B5CFF', '#34CF78', '#FF8A3D', '#ffffff'];

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  c: string;
  shape: number;
  life: number;
}

/** Full-screen confetti burst. Re-fires whenever `fire` changes. */
export function Confetti({ fire, amount = 160 }: { fire: unknown; amount?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    if (document.documentElement.classList.contains('reduced-motion')) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
    };
    resize();
    const W = () => cv.width;
    const parts: P[] = [];
    for (let i = 0; i < amount; i++) {
      const side = i % 2 === 0;
      parts.push({
        x: side ? W() * 0.1 : W() * 0.9,
        y: cv.height * 0.55,
        vx: (side ? 1 : -1) * (6 + Math.random() * 9) * dpr,
        vy: -(12 + Math.random() * 14) * dpr,
        r: (4 + Math.random() * 6) * dpr,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.floor(Math.random() * 3),
        life: 1,
      });
    }
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.45 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > cv.height + 40) continue;
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.r);
          ctx.lineTo(p.r, p.r);
          ctx.lineTo(-p.r, p.r);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [fire, amount]);
  return <canvas ref={ref} className="confetti-canvas" aria-hidden="true" />;
}
