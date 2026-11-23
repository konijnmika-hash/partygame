// Tiny procedural chiptune sequencer for lobby / game / podium music. Original compositions.
import { audio, midi, musicOut } from './sfx';

type Track = 'lobby' | 'game' | 'final';

interface Song {
  bpm: number;
  chords: number[][]; // midi notes per bar
  bass: (number | null)[]; // 16 steps, semitone offset from chord root (null = rest)
  lead: (number | null)[][]; // per bar, 16 steps of midi notes
  drums: string; // 16 chars: k=kick s=snare h=hat .=rest
  arp: boolean;
  leadWave: OscillatorType;
}

const SONGS: Record<Track, Song> = {
  lobby: {
    bpm: 112,
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    bass: [0, null, null, 0, null, null, 12, null, 0, null, null, 0, null, 7, null, null],
    lead: [
      [72, null, 76, null, 79, null, 76, null, 77, 76, 74, null, 72, null, null, null],
      [69, null, 72, null, 76, null, 72, null, 74, null, 72, null, 69, null, 67, null],
      [65, null, 69, null, 72, null, 69, null, 72, 74, 72, null, 69, null, null, null],
      [67, null, 71, null, 74, null, 79, null, 77, null, 74, null, 71, null, 74, null],
    ],
    drums: 'k.h.s.h.k.hks.h.',
    arp: true,
    leadWave: 'square',
  },
  game: {
    bpm: 132,
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
    bass: [0, null, 0, null, 12, null, 0, null, 0, null, 0, null, 7, null, 10, null],
    lead: [[null], [null], [null], [null]],
    drums: 'k.h.s.hkk.h.s.hh',
    arp: true,
    leadWave: 'triangle',
  },
  final: {
    bpm: 120,
    chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    bass: [0, null, null, null, 7, null, null, null, 0, null, 12, null, 7, null, null, null],
    lead: [
      [72, null, 72, 74, 76, null, 72, null, 79, null, null, null, 76, null, null, null],
      [77, null, 77, 76, 74, null, 72, null, 74, null, null, null, 72, null, null, null],
      [74, null, 76, 77, 79, null, 77, null, 76, null, 74, null, 72, null, 71, null],
      [72, null, null, null, 79, null, 76, null, 72, null, null, null, null, null, null, null],
    ],
    drums: 'k...s...k.k.s...',
    arp: false,
    leadWave: 'square',
  },
};

let current: Track | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;
let noise: AudioBuffer | null = null;

function playNote(freq: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff = 2400) {
  const c = audio();
  const out = musicOut();
  if (!c || !out) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(kind: string, t: number) {
  const c = audio();
  const out = musicOut();
  if (!c || !out) return;
  if (kind === 'k') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.18);
    return;
  }
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  if (kind === 's') {
    f.type = 'bandpass';
    f.frequency.value = 1800;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  } else {
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  }
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.2);
}

function schedule() {
  const c = audio();
  if (!c || !current) return;
  const song = SONGS[current];
  const stepDur = 60 / song.bpm / 4;
  while (nextTime < c.currentTime + 0.12) {
    const bar = Math.floor(step / 16) % song.chords.length;
    const s16 = step % 16;
    const chord = song.chords[bar];
    const root = chord[0] - 24;
    const b = song.bass[s16];
    if (b != null) playNote(midi(root + b), nextTime, stepDur * 1.8, 'triangle', 0.32, 900);
    if (song.arp && s16 % 2 === 0) {
      const note = chord[(s16 / 2) % chord.length] + 12;
      playNote(midi(note), nextTime, stepDur * 1.2, 'square', 0.045, 2600);
    }
    if (!song.arp && s16 % 4 === 0) for (const n of chord) playNote(midi(n), nextTime, stepDur * 3, 'triangle', 0.05, 2000);
    const lead = song.lead[bar]?.[s16];
    if (lead != null) playNote(midi(lead), nextTime, stepDur * 1.7, song.leadWave, 0.07, 3200);
    const d = song.drums[s16];
    if (d && d !== '.') drum(d, nextTime);
    nextTime += stepDur;
    step++;
  }
}

export function playMusic(track: Track | null): void {
  if (track === current) return;
  stopMusic();
  if (!track) return;
  const c = audio();
  if (!c) return;
  current = track;
  step = 0;
  nextTime = c.currentTime + 0.1;
  timer = window.setInterval(schedule, 30);
}

export function stopMusic(): void {
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
}

export function currentTrack(): Track | null {
  return current;
}
