import './weird.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, ChoiceGrid, Countdown, MiniScores, RoundDots } from '../../game/kit';
import { serverNow } from '../../net/clock';
import { midi, sfx, sfxEnabled, tone } from '../../audio/sfx';

interface Pub {
  r: number;
  n: number;
  phase: 'listen' | 'reveal';
  startAt: number;
  deadline: number;
  tune: [number, number][] | null;
  bpm: number;
  instrument: string;
  options: string[];
  answered: string[];
  answer: number | null;
  picks: Record<string, { c: number; ms: number }> | null;
  scores: Record<string, number>;
}

const ICON: Record<string, string> = { kazoo: '🎺', robot: '🤖', bubbles: '🫧', 'music box': '🎁', 'wobble bass': '🔊', chiptune: '👾' };

/** One note on a weird instrument (all synthesized). */
function playNote(inst: string, m: number, dur: number) {
  const f = midi(m);
  switch (inst) {
    case 'kazoo':
      tone(f, dur, { type: 'sawtooth', vol: 0.12, filter: 1700, attack: 0.03 });
      tone(f, dur, { type: 'sawtooth', vol: 0.08, filter: 1700, detune: 18, attack: 0.04 });
      break;
    case 'robot':
      tone(f, dur, { type: 'square', vol: 0.1, filter: 1300 });
      tone(f * 2, dur * 0.5, { type: 'square', vol: 0.04, filter: 2500 });
      break;
    case 'bubbles':
      tone(f, Math.min(dur, 0.22), { type: 'sine', vol: 0.32, slideTo: f * 1.7 });
      break;
    case 'music box':
      tone(f * 2, Math.max(0.5, dur), { type: 'triangle', vol: 0.22, release: 0.45 });
      tone(f * 4, 0.3, { type: 'sine', vol: 0.05 });
      break;
    case 'wobble bass':
      tone(f / 2, dur, { type: 'sawtooth', vol: 0.16, filter: 520, slideTo: f / 2 * 0.97 });
      break;
    default:
      tone(f, dur * 0.9, { type: 'square', vol: 0.08, filter: 4000 });
      tone(f * 2, dur * 0.3, { type: 'square', vol: 0.03, when: 0.02 });
  }
}

export default function GuessSound({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: number | null }>) {
  const [played, setPlayed] = useState<number[]>([]);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  // play notes as their time arrives (looping the tune with a short pause)
  useEffect(() => {
    setPlayed([]);
    if (pub.phase !== 'listen' || !pub.tune) return;
    const tune = pub.tune;
    const beat = 60000 / pub.bpm;
    const starts: number[] = [];
    let acc = 0;
    for (const [, d] of tune) {
      starts.push(acc * beat);
      acc += d;
    }
    const loopLen = acc * beat + 1400;
    let next = 0;
    let loop = 0;
    const iv = setInterval(() => {
      const p = pubRef.current;
      if (p.phase !== 'listen') return;
      const t = serverNow() - p.startAt - loop * loopLen;
      if (t < 0) return;
      while (next < tune.length && starts[next] <= t) {
        if (t - starts[next] < 250) playNote(p.instrument, tune[next][0], (tune[next][1] * beat) / 1000 * 0.9);
        setPlayed((x) => [...x, tune[next][0]].slice(-40));
        next++;
      }
      if (next >= tune.length && t >= loopLen) {
        loop++;
        next = 0;
      }
    }, 30);
    return () => clearInterval(iv);
  }, [pub.r, pub.phase]);
  useEffect(() => {
    if (pub.phase === 'reveal' && priv?.mine != null) sfx(priv.mine === pub.answer ? 'correct' : 'wrong');
  }, [pub.phase]);
  const lo = Math.min(...(pub.tune ?? [[60, 1]]).map((x) => x[0]));
  const hi = Math.max(...(pub.tune ?? [[72, 1]]).map((x) => x[0]));
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.r} />
      <div className="instrument">{ICON[pub.instrument] ?? '🎵'} Played on: {pub.instrument}</div>
      {!sfxEnabled() && <Banner title="🔇 Your sound is off!" sub="Turn on sound effects to hear the tune (the bars still show the melody)" tone="warn" />}
      <Countdown deadline={pub.phase === 'listen' ? pub.deadline : null} total={16000} />
      <div className="note-bars">
        {played.map((m, i) => <i key={i} style={{ height: `${20 + ((m - lo) / Math.max(1, hi - lo)) * 80}%` }} />)}
      </div>
      <ChoiceGrid
        compact
        cols={2}
        choices={pub.options.map((o) => ({ label: o }))}
        picked={priv?.mine ?? null}
        correct={pub.answer}
        wrong={pub.answer != null && priv?.mine != null && priv.mine !== pub.answer ? [priv.mine] : []}
        disabled={!isPlayer || priv?.mine != null || pub.phase !== 'listen' || serverNow() < pub.startAt}
        onPick={(c) => send({ t: 'pick', c })}
      />
      {priv?.mine != null && pub.phase === 'listen' && <div className="small">Locked in — {pub.answered.length}/{players.length} answered</div>}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </div>
  );
}
