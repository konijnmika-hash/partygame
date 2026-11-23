// Original line-art doodles (built from simple primitives) + shape similarity scoring.
// Coordinates are in a 1000x1000 canvas space. Each doodle = list of polylines [x,y,x,y,...].

type Poly = number[];

function circle(cx: number, cy: number, r: number, n = 28, a0 = 0, a1 = Math.PI * 2): Poly {
  const out: Poly = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
  }
  return out;
}
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 28): Poly {
  const out: Poly = [];
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * 2 * i) / n;
    out.push(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry));
  }
  return out;
}
const rect = (x: number, y: number, w: number, h: number): Poly => [x, y, x + w, y, x + w, y + h, x, y + h, x, y];
const line = (...pts: number[]): Poly => pts;
function star(cx: number, cy: number, r1: number, r2: number, n = 5): Poly {
  const out: Poly = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const r = i % 2 ? r2 : r1;
    out.push(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
  }
  return out;
}

export interface Doodle {
  name: string;
  strokes: Poly[];
}

export const DOODLES: Doodle[] = [
  { name: 'House', strokes: [rect(260, 460, 480, 360), line(220, 480, 500, 220, 780, 480), rect(450, 640, 100, 180), rect(320, 540, 90, 80), rect(590, 540, 90, 80)] },
  { name: 'Tree', strokes: [line(450, 850, 460, 580, 540, 580, 550, 850), circle(500, 440, 190), circle(390, 520, 110, 20), circle(610, 520, 110, 20)] },
  { name: 'Sun', strokes: [circle(500, 500, 170), ...Array.from({ length: 8 }, (_, i) => { const a = (Math.PI * i) / 4; return line(Math.round(500 + Math.cos(a) * 220), Math.round(500 + Math.sin(a) * 220), Math.round(500 + Math.cos(a) * 330), Math.round(500 + Math.sin(a) * 330)); })] },
  { name: 'Fish', strokes: [ellipse(450, 500, 260, 150), line(700, 500, 860, 380, 860, 620, 700, 500), circle(330, 460, 25, 12), line(500, 400, 540, 500, 500, 600)] },
  { name: 'Star', strokes: [star(500, 520, 340, 140)] },
  { name: 'Heart', strokes: [[500, 820, 230, 560, 180, 420, 220, 300, 320, 240, 430, 260, 500, 360, 570, 260, 680, 240, 780, 300, 820, 420, 770, 560, 500, 820]] },
  { name: 'Cat', strokes: [circle(500, 540, 260), line(290, 400, 310, 170, 430, 300), line(710, 400, 690, 170, 570, 300), circle(410, 500, 30, 12), circle(590, 500, 30, 12), line(470, 600, 500, 630, 530, 600), line(300, 600, 160, 580), line(300, 640, 160, 680), line(700, 600, 840, 580), line(700, 640, 840, 680)] },
  { name: 'Car', strokes: [line(140, 640, 140, 520, 290, 500, 380, 380, 640, 380, 740, 500, 860, 520, 860, 640, 140, 640), circle(300, 660, 70, 16), circle(700, 660, 70, 16), line(410, 400, 400, 500), line(610, 400, 620, 500)] },
  { name: 'Rocket', strokes: [line(500, 120, 620, 300, 620, 680, 380, 680, 380, 300, 500, 120), circle(500, 400, 60, 16), line(380, 560, 270, 720, 380, 680), line(620, 560, 730, 720, 620, 680), line(440, 680, 500, 860, 560, 680)] },
  { name: 'Flower', strokes: [circle(500, 360, 70, 16), circle(500, 230, 80, 18), circle(630, 360, 80, 18), circle(500, 490, 80, 18), circle(370, 360, 80, 18), line(500, 440, 500, 880), line(500, 700, 620, 620), line(500, 760, 380, 680)] },
  { name: 'Umbrella', strokes: [[160, 500, 220, 330, 360, 220, 500, 190, 640, 220, 780, 330, 840, 500, 760, 460, 660, 500, 580, 460, 500, 500, 420, 460, 340, 500, 240, 460, 160, 500], line(500, 500, 500, 800, 470, 840, 420, 820)] },
  { name: 'Cup', strokes: [line(300, 300, 340, 780, 620, 780, 660, 300, 300, 300), [660, 380, 760, 380, 780, 480, 740, 580, 640, 600], line(380, 220, 400, 160), line(480, 220, 500, 140), line(580, 220, 600, 160)] },
  { name: 'Key', strokes: [circle(320, 500, 130), line(450, 500, 840, 500, 840, 590), line(740, 500, 740, 580), line(650, 500, 650, 560)] },
  { name: 'Moon', strokes: [[600, 160, 450, 220, 360, 360, 350, 520, 420, 680, 560, 800, 720, 830, 620, 760, 540, 640, 510, 500, 530, 360, 600, 240, 600, 160]] },
  { name: 'Cloud', strokes: [[220, 640, 180, 560, 230, 470, 330, 460, 380, 360, 500, 320, 620, 370, 660, 450, 770, 460, 830, 550, 790, 640, 220, 640]] },
  { name: 'Apple', strokes: [[500, 330, 400, 280, 280, 320, 230, 450, 260, 620, 360, 760, 450, 790, 500, 770, 550, 790, 640, 760, 740, 620, 770, 450, 720, 320, 600, 280, 500, 330], line(500, 330, 520, 200), [520, 250, 600, 190, 680, 210, 610, 260, 520, 250]] },
  { name: 'Boat', strokes: [line(160, 600, 840, 600, 720, 760, 280, 760, 160, 600), line(500, 600, 500, 160), line(500, 180, 740, 520, 500, 520)] },
  { name: 'Glasses', strokes: [circle(320, 500, 130), circle(680, 500, 130), line(450, 480, 550, 480), line(190, 480, 100, 420), line(810, 480, 900, 420)] },
  { name: 'Crown', strokes: [line(200, 720, 200, 360, 350, 520, 500, 280, 650, 520, 800, 360, 800, 720, 200, 720), circle(500, 240, 30, 10)] },
  { name: 'Ghost', strokes: [[300, 800, 300, 420, 340, 280, 420, 210, 500, 190, 580, 210, 660, 280, 700, 420, 700, 800, 640, 740, 580, 800, 500, 740, 420, 800, 360, 740, 300, 800], circle(430, 420, 30, 12), circle(570, 420, 30, 12), ellipse(500, 540, 40, 55, 16)] },
  { name: 'Snowman', strokes: [circle(500, 680, 190), circle(500, 380, 130), circle(500, 180, 0.1, 2), line(440, 260, 560, 260, 540, 200, 460, 200, 440, 260), circle(455, 360, 15, 8), circle(545, 360, 15, 8), line(500, 400, 600, 420, 500, 430)] },
  { name: 'Ice cream', strokes: [line(330, 450, 500, 880, 670, 450), circle(500, 380, 180, 28, Math.PI, Math.PI * 2), line(320, 400, 330, 450, 670, 450, 680, 400), line(400, 520, 560, 640), line(600, 520, 440, 680)] },
  { name: 'Pizza', strokes: [line(500, 820, 220, 260, 780, 260, 500, 820), [220, 260, 300, 200, 400, 170, 500, 160, 600, 170, 700, 200, 780, 260], circle(450, 360, 40, 12), circle(560, 420, 40, 12), circle(500, 560, 35, 12)] },
  { name: 'Light bulb', strokes: [[420, 640, 400, 560, 330, 480, 300, 380, 330, 270, 420, 200, 500, 180, 580, 200, 670, 270, 700, 380, 670, 480, 600, 560, 580, 640, 420, 640], rect(420, 640, 160, 70), line(440, 760, 560, 760), line(460, 800, 540, 800)] },
  { name: 'Mushroom', strokes: [[160, 520, 200, 360, 320, 250, 500, 210, 680, 250, 800, 360, 840, 520, 160, 520], line(400, 520, 390, 800, 610, 800, 600, 520), circle(380, 380, 40, 12), circle(560, 330, 50, 12), circle(700, 430, 35, 12)] },
  { name: 'Envelope', strokes: [rect(180, 300, 640, 420), line(180, 300, 500, 540, 820, 300), line(180, 720, 420, 480), line(820, 720, 580, 480)] },
  { name: 'Clock', strokes: [circle(500, 500, 300), line(500, 500, 500, 300), line(500, 500, 640, 560), ...[0, 1, 2, 3].map((k) => { const a = (Math.PI / 2) * k; return line(Math.round(500 + Math.cos(a) * 260), Math.round(500 + Math.sin(a) * 260), Math.round(500 + Math.cos(a) * 300), Math.round(500 + Math.sin(a) * 300)); })] },
  { name: 'Balloon', strokes: [ellipse(500, 360, 190, 230), line(480, 590, 500, 620, 520, 590, 480, 590), [500, 620, 470, 700, 530, 780, 480, 860]] },
  { name: 'Kite', strokes: [line(500, 140, 720, 400, 500, 720, 280, 400, 500, 140), line(500, 140, 500, 720), line(280, 400, 720, 400), [500, 720, 460, 790, 540, 840, 470, 900]] },
  { name: 'Candle', strokes: [rect(400, 380, 200, 440), [500, 360, 450, 280, 500, 160, 550, 280, 500, 360], line(500, 360, 500, 380)] },
  { name: 'Bell', strokes: [[280, 700, 320, 600, 330, 420, 380, 300, 500, 240, 620, 300, 670, 420, 680, 600, 720, 700, 280, 700], circle(500, 750, 45, 12), line(500, 240, 500, 180)] },
  { name: 'Butterfly', strokes: [line(500, 280, 500, 740), [500, 400, 380, 220, 220, 230, 200, 380, 300, 480, 500, 480], [500, 400, 620, 220, 780, 230, 800, 380, 700, 480, 500, 480], [500, 520, 360, 520, 280, 640, 360, 740, 500, 640], [500, 520, 640, 520, 720, 640, 640, 740, 500, 640], line(500, 280, 440, 180), line(500, 280, 560, 180)] },
];

export const DOODLE_NAMES = DOODLES.map((d) => d.name);

// ---------- similarity ----------

/** Resample polylines into evenly spaced points (spacing in canvas units). */
export function resample(strokes: Poly[], spacing = 18): number[] {
  const out: number[] = [];
  for (const p of strokes) {
    if (p.length < 2) continue;
    out.push(p[0], p[1]);
    let carry = 0;
    for (let i = 2; i < p.length; i += 2) {
      const x0 = p[i - 2], y0 = p[i - 1], x1 = p[i], y1 = p[i + 1];
      const seg = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
      let d = spacing - carry;
      while (d <= seg) {
        const t = d / seg;
        out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        d += spacing;
      }
      carry = seg - (d - spacing);
    }
  }
  return out;
}

/** For each point of `a`, distance to the nearest point of `b` (capped). */
function nearestDists(a: number[], b: number[], cap: number): number[] {
  const out: number[] = [];
  if (!a.length) return out;
  for (let i = 0; i < a.length; i += 2) {
    let best = cap * cap;
    for (let j = 0; j < b.length; j += 2) {
      const dx = a[i] - b[j];
      const dy = a[i + 1] - b[j + 1];
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    out.push(Math.sqrt(best));
  }
  return out;
}

function inkLength(strokes: Poly[]): number {
  let len = 0;
  for (const p of strokes) for (let i = 2; i < p.length; i += 2) len += Math.sqrt((p[i] - p[i - 2]) ** 2 + (p[i + 1] - p[i - 1]) ** 2);
  return len;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Accuracy 0..1 of a drawing vs a target (positions matter):
 *  - coverage: share of the target outline that has ink within reach, plus average distance
 *  - precision: how close the ink stays to the target outline
 *  - scribble penalty: far more ink than the target needs is suspicious
 */
export function drawingAccuracy(target: Poly[], drawing: Poly[]): number {
  const t = resample(target, 18);
  const d = resample(drawing, 18).slice(0, 4000);
  if (d.length < 6 || !t.length) return 0;
  const cap = 400;
  const cov = nearestDists(t, d, cap);
  const prec = nearestDists(d, t, cap);
  const covFrac = cov.filter((x) => x <= 42).length / cov.length;
  const covAvg = cov.reduce((a, b) => a + b, 0) / cov.length;
  const precAvg = prec.reduce((a, b) => a + b, 0) / prec.length;
  const covScore = clamp01(1 - (covAvg - 8) / 95);
  const precScore = clamp01(1 - (precAvg - 8) / 95);
  const ratio = inkLength(drawing) / Math.max(1, inkLength(target));
  const inkPenalty = ratio > 1.6 ? clamp01(1 - (ratio - 1.6) / 1.4) : 1;
  return clamp01((0.45 * covFrac + 0.25 * covScore + 0.3 * precScore) * inkPenalty);
}
