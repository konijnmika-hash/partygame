// Procedural sound effects (WebAudio). Every sound is synthesized at runtime: no audio files.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const vol = { sfx: 0.8, music: 0.45, sfxMuted: false, musicMuted: false };

let gestured = false;

export function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (!gestured) return null; // browsers block audio until the first user gesture
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC() as AudioContext;
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  applyVolumes();
  return ctx;
}

export function musicOut(): GainNode | null {
  audio();
  return musicBus;
}

export function sfxOut(): GainNode | null {
  audio();
  return sfxBus;
}

export function unlockAudio(): void {
  gestured = true;
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setVolumes(v: { sfxVolume: number; musicVolume: number; sfxMuted: boolean; musicMuted: boolean }): void {
  vol.sfx = v.sfxVolume;
  vol.music = v.musicVolume;
  vol.sfxMuted = v.sfxMuted;
  vol.musicMuted = v.musicMuted;
  applyVolumes();
}

export function sfxEnabled(): boolean {
  return !vol.sfxMuted && vol.sfx > 0;
}

function applyVolumes() {
  if (!ctx || !sfxBus || !musicBus) return;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(vol.sfxMuted ? 0 : vol.sfx, t, 0.02);
  musicBus.gain.setTargetAtTime(vol.musicMuted ? 0 : vol.music * 0.55, t, 0.05);
}

function noise(): AudioBuffer {
  const c = ctx!;
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  attack?: number;
  release?: number;
  slideTo?: number;
  when?: number;
  out?: AudioNode | null;
  detune?: number;
  filter?: number;
}

/** Play a single enveloped tone. Exposed so games (pads, melodies) can use the same synth. */
export function tone(freq: number, dur: number, o: ToneOpts = {}): void {
  const c = audio();
  if (!c) return;
  const out = o.out ?? sfxBus;
  if (!out) return;
  const t0 = c.currentTime + (o.when ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
  const a = o.attack ?? 0.005;
  const r = o.release ?? Math.min(0.25, dur * 0.6);
  const v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.setValueAtTime(v, t0 + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, o: { vol?: number; freq?: number; type?: BiquadFilterType; when?: number; sweepTo?: number; q?: number; out?: AudioNode | null } = {}) {
  const c = audio();
  if (!c) return;
  const out = o.out ?? sfxBus;
  if (!out) return;
  const t0 = c.currentTime + (o.when ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise();
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 2000, t0);
  if (o.q) f.Q.value = o.q;
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
  const g = c.createGain();
  const v = o.vol ?? 0.3;
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5, E6 = 1318.5, G4 = 392, F4 = 349.23, E4 = 329.63;

export type SfxName =
  | 'click' | 'blip' | 'pop' | 'tick' | 'tock' | 'go' | 'correct' | 'wrong' | 'win' | 'lose' | 'coin' | 'achievement'
  | 'levelup' | 'whoosh' | 'boom' | 'jump' | 'hit' | 'splash' | 'join' | 'countdown' | 'select' | 'buzz' | 'swap' | 'ding' | 'tap' | 'cheer' | 'draw';

let lastPlayed: Record<string, number> = {};

export function sfx(name: SfxName, pitch = 1): void {
  if (!sfxEnabled()) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  const now = performance.now();
  if (now - (lastPlayed[name] ?? 0) < 25) return; // de-dupe floods
  lastPlayed[name] = now;
  const p = pitch;
  switch (name) {
    case 'click': tone(700 * p, 0.05, { type: 'square', vol: 0.08, slideTo: 900 * p, filter: 3000 }); break;
    case 'select': tone(520 * p, 0.06, { type: 'triangle', vol: 0.18 }); break;
    case 'tap': tone(420 * p, 0.05, { type: 'sine', vol: 0.22, slideTo: 640 * p }); break;
    case 'blip': tone(880 * p, 0.07, { type: 'sine', vol: 0.16 }); break;
    case 'pop': tone(300 * p, 0.09, { type: 'sine', vol: 0.3, slideTo: 900 * p }); break;
    case 'tick': tone(1250, 0.035, { type: 'triangle', vol: 0.2 }); break;
    case 'tock': tone(850, 0.035, { type: 'triangle', vol: 0.18 }); break;
    case 'countdown': tone(660, 0.12, { type: 'square', vol: 0.12, filter: 2200 }); break;
    case 'go':
      [C5, E5, G5, C6].forEach((f, i) => tone(f, 0.16, { type: 'square', vol: 0.12, when: i * 0.05, filter: 3500 }));
      break;
    case 'correct':
      tone(E5 * p, 0.1, { type: 'triangle', vol: 0.25 });
      tone(B5 * p, 0.18, { type: 'triangle', vol: 0.25, when: 0.08 });
      break;
    case 'ding': tone(A5 * p, 0.4, { type: 'sine', vol: 0.22, release: 0.35 }); tone(A5 * 2 * p, 0.3, { type: 'sine', vol: 0.06 }); break;
    case 'wrong':
      tone(150, 0.28, { type: 'sawtooth', vol: 0.18, filter: 900, slideTo: 110 });
      break;
    case 'buzz': tone(110, 0.4, { type: 'square', vol: 0.12, filter: 700 }); break;
    case 'win':
      [C5, E5, G5, C6].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.25, when: i * 0.09 }));
      [C5, E5, G5].forEach((f) => tone(f * 2, 0.6, { type: 'sine', vol: 0.1, when: 0.4 }));
      break;
    case 'lose':
      [G4, 370, F4, E4].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.22, { type: 'sawtooth', vol: 0.12, when: i * 0.22, filter: 1400 }));
      break;
    case 'coin':
      tone(B5 * p, 0.06, { type: 'square', vol: 0.12, filter: 4000 });
      tone(E6 * p, 0.2, { type: 'square', vol: 0.12, when: 0.06, filter: 4000 });
      break;
    case 'achievement':
      [C6, E6, G5 * 2, C6 * 2].forEach((f, i) => tone(f, 0.25, { type: 'sine', vol: 0.12, when: i * 0.07 }));
      noiseBurst(0.5, { vol: 0.05, type: 'highpass', freq: 6000 });
      break;
    case 'levelup':
      [C5, D5, E5, G5, A5, C6].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.2, when: i * 0.06 }));
      break;
    case 'whoosh': noiseBurst(0.35, { vol: 0.2, type: 'bandpass', freq: 400, sweepTo: 3000, q: 1.2 }); break;
    case 'boom':
      noiseBurst(0.6, { vol: 0.4, type: 'lowpass', freq: 1200, sweepTo: 80 });
      tone(120, 0.45, { type: 'sine', vol: 0.4, slideTo: 40 });
      break;
    case 'jump': tone(280 * p, 0.14, { type: 'square', vol: 0.1, slideTo: 720 * p, filter: 2500 }); break;
    case 'hit':
      noiseBurst(0.12, { vol: 0.3, type: 'lowpass', freq: 2500 });
      tone(160, 0.12, { type: 'sine', vol: 0.3, slideTo: 70 });
      break;
    case 'splash': noiseBurst(0.4, { vol: 0.22, type: 'bandpass', freq: 1800, sweepTo: 500, q: 0.8 }); break;
    case 'join':
      tone(G5, 0.08, { type: 'sine', vol: 0.2 });
      tone(C6, 0.2, { type: 'sine', vol: 0.2, when: 0.08 });
      break;
    case 'swap': tone(600 * p, 0.06, { type: 'triangle', vol: 0.15, slideTo: 400 * p }); break;
    case 'cheer':
      for (let i = 0; i < 6; i++) noiseBurst(0.3, { vol: 0.06, type: 'bandpass', freq: 1500 + Math.random() * 1500, when: i * 0.05, q: 2 });
      break;
    case 'draw': noiseBurst(0.05, { vol: 0.03, type: 'highpass', freq: 3000 }); break;
  }
}

/** Note frequency helper: midi number -> Hz */
export function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}


export function vibrate(pattern: number | number[]): void {
  try {
    if ((window as any).__bbHaptics !== false && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}
