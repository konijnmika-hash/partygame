import './weird.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, ChoiceGrid, Countdown, MiniScores, RoundDots } from '../../game/kit';
import { toast } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  r: number;
  n: number;
  phase: 'perform' | 'listen' | 'reveal';
  deadline: number;
  actor: string | null;
  options: { name: string; emoji: string }[];
  clipKind: 'audio' | 'synth' | null;
  answered: string[];
  answer: number | null;
  phrase: string | null;
  picks: Record<string, number> | null;
  scores: Record<string, number>;
}
type Priv =
  | { role: 'listener'; myPick: number | null }
  | { role: 'actor'; character: string; emoji: string; phrase: string; preset: { pitch: number; rate: number } };
type Clip = { kind: 'audio'; data: string } | { kind: 'synth'; pitch: number; rate: number; text: string };

const MAX_REC_MS = 6000;
const MAX_DATA = 210_000;

function speak(text: string, pitch: number, rate: number) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) {
    toast('Voice synthesis is not available on this device', 'error');
    return;
  }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = Math.max(0, Math.min(2, pitch));
  u.rate = Math.max(0.1, Math.min(4, rate));
  u.lang = 'en-US';
  synth.speak(u);
}

let current: HTMLAudioElement | null = null;
function playClip(c: Clip) {
  if (c.kind === 'synth') return speak(c.text, c.pitch, c.rate);
  current?.pause();
  current = new Audio(c.data);
  current.play().catch(() => toast('Tap ▶ to play the clip', 'info'));
}

function Recorder({ onDone }: { onDone: (data: string) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'done'>('idle');
  const [data, setData] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined';
  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  }, []);
  if (!supported) return <div className="small">🎙️ Recording isn't available here — use the synthesizer instead.</div>;
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => (window as any).MediaRecorder.isTypeSupported?.(m)) ?? '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        const fr = new FileReader();
        fr.onload = () => {
          const url = String(fr.result);
          if (url.length > MAX_DATA) {
            toast('That clip is too long — try a shorter take', 'error');
            setState('idle');
            return;
          }
          setData(url);
          setState('done');
        };
        fr.readAsDataURL(blob);
      };
      rec.current = r;
      r.start();
      setState('rec');
      sfx('select');
      stopTimer.current = setTimeout(() => r.state === 'recording' && r.stop(), MAX_REC_MS);
    } catch {
      toast('Microphone permission was denied — use the synthesizer instead', 'error');
    }
  };
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
      {state === 'idle' && <button className="btn btn-pink" onClick={start}>🎙️ Record (max 6 s)</button>}
      {state === 'rec' && <button className="btn" onClick={() => rec.current?.stop()}><span className="rec-dot" /> Stop recording</button>}
      {state === 'done' && data && (
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          <button className="btn" onClick={() => playClip({ kind: 'audio', data })}>▶ Preview</button>
          <button className="btn" onClick={() => { setData(null); setState('idle'); }}>↺ Retake</button>
          <button className="btn btn-green" onClick={() => onDone(data)}>Send it!</button>
        </div>
      )}
    </div>
  );
}

export default function VoiceGuess({ pub, priv, me, isPlayer, send, players, player, assets }: GameViewProps<Pub, Priv>) {
  const [mode, setMode] = useState<'mic' | 'synth'>('mic');
  const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);
  const clip = assets[`vg:${pub.r}`] as Clip | undefined;
  const autoPlayed = useRef(-1);
  useEffect(() => {
    setMode('mic');
    setPitch(1);
    setRate(1);
  }, [pub.r]);
  // everyone hears the performance once automatically
  useEffect(() => {
    if (pub.phase === 'listen' && clip && autoPlayed.current !== pub.r) {
      autoPlayed.current = pub.r;
      playClip(clip);
    }
  }, [pub.phase, !!clip, pub.r]);
  useEffect(() => {
    if (pub.phase === 'reveal' && priv?.role === 'listener' && priv.myPick != null) sfx(priv.myPick === pub.answer ? 'correct' : 'wrong');
  }, [pub.phase]);
  const actor = pub.actor ? player(pub.actor) : null;
  const iAct = priv?.role === 'actor';
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.r} />
      <div className="row-nw" style={{ gap: 8 }}>
        {actor && <Avatar avatar={actor.avatar} size={34} bob={pub.phase === 'perform'} />}
        <b>{iAct ? 'You are performing!' : `${actor?.name ?? '…'} is performing`}</b>
      </div>
      <Countdown deadline={pub.phase === 'reveal' ? null : pub.deadline} total={pub.phase === 'perform' ? 30000 : 22000} />
      {pub.phase === 'perform' && iAct && priv?.role === 'actor' && (
        <>
          <div className="scene-card">
            <div className="scene-emoji">{priv.emoji}</div>
            <b>Be: {priv.character}</b>
            <span>Say: “{priv.phrase}”</span>
          </div>
          <div className="voice-modes">
            <button className={`btn ${mode === 'mic' ? 'btn-pink' : ''}`} onClick={() => setMode('mic')}>🎙️ My voice</button>
            <button className={`btn ${mode === 'synth' ? 'btn-pink' : ''}`} onClick={() => setMode('synth')}>🤖 Synthesizer</button>
          </div>
          {mode === 'mic' ? (
            <Recorder onDone={(data) => { sfx('whoosh'); send({ t: 'voice', data }); }} />
          ) : (
            <>
              <label className="slider-row">Pitch <input type="range" min={0.1} max={2} step={0.05} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} /></label>
              <label className="slider-row">Speed <input type="range" min={0.4} max={2} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
              <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                <button className="btn" onClick={() => speak(priv.phrase, pitch, rate)}>▶ Preview</button>
                <button className="btn btn-green" onClick={() => { sfx('whoosh'); send({ t: 'synth', pitch, rate }); }}>Perform it!</button>
              </div>
            </>
          )}
        </>
      )}
      {pub.phase === 'perform' && !iAct && <Banner title={`🎭 ${actor?.name ?? 'The actor'} is warming up their voice…`} sub="Get ready to guess the character!" />}
      {(pub.phase === 'listen' || pub.phase === 'reveal') && (
        <>
          {clip && <button className="btn" onClick={() => playClip(clip)}>▶ Play again {pub.clipKind === 'synth' ? '(synth)' : ''}</button>}
          {pub.phrase && <div className="small">They said: “{pub.phrase}”</div>}
          <ChoiceGrid
            compact
            cols={2}
            choices={pub.options.map((o) => ({ label: <><span style={{ fontSize: '1.5rem' }}>{o.emoji}</span> {o.name}</> }))}
            picked={priv?.role === 'listener' ? priv.myPick : null}
            correct={pub.answer}
            wrong={pub.answer != null && priv?.role === 'listener' && priv.myPick != null && priv.myPick !== pub.answer ? [priv.myPick] : []}
            disabled={!isPlayer || iAct || pub.phase !== 'listen' || (priv?.role === 'listener' && priv.myPick != null)}
            onPick={(c) => send({ t: 'pick', c })}
          />
          {pub.phase === 'reveal' && pub.picks && <div className="small">Recognised by: {Object.entries(pub.picks).filter(([, c]) => c === pub.answer).map(([id]) => nm(players, id)).join(', ') || 'nobody 🙈'}</div>}
        </>
      )}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </div>
  );
}
