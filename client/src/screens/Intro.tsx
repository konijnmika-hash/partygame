import { useEffect, useState } from 'react';
import { GAME_MAP } from '@shared/catalog/index';
import { CATEGORY_MAP } from '@shared/categories';
import type { Control } from '@shared/types';
import { useStore } from '../state/store';
import { emit } from '../net/socket';
import { useNow, Avatar } from '../components/ui';
import { preloadView } from '../game/registry';
import { updateSettings } from '../boot';
import { sfx } from '../audio/sfx';
import { isTouchDevice } from '../game/input';

const CONTROL_LABEL: Record<Control, string> = {
  tap: '👆 Tap',
  swipe: '👉 Swipe',
  drag: '✋ Drag',
  draw: '🖍️ Draw',
  type: '⌨️ Type',
  joystick: '🕹️ Joystick',
  keys: '⌨️ WASD / Arrows',
  vote: '🗳️ Vote',
  mic: '🎙️ Mic (optional)',
  hold: '✊ Hold',
  tilt: '📱 Tilt',
  numpad: '🔢 Number pad',
};

export function Intro() {
  const room = useStore((s) => s.room!);
  const me = useStore((s) => s.profile!.id);
  const sfxMuted = useStore((s) => s.settings.sfxMuted);
  const round = room.round!;
  const meta = GAME_MAP[round.gameId];
  const cat = CATEGORY_MAP[meta.category];
  const now = useNow(100);
  const left = room.phaseEndsAt ? Math.max(0, (room.phaseEndsAt - now) / 1000) : 0;
  const secs = Math.ceil(left);
  const meMember = room.members.find((m) => m.id === me);
  const waiting = room.members.filter((m) => !m.isBot && m.connected && !m.ready && m.status !== 'spectating');
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);

  useEffect(() => {
    preloadView(round.gameId);
  }, [round.gameId]);
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    if (secs > 0 && secs <= 3) sfx('countdown');
  }, [secs]);

  return (
    <div className="page intro" style={{ ['--g1' as any]: cat.gradient[0], ['--g2' as any]: cat.gradient[1] }}>
      <div className="intro-top">
        <span className="chip chip-dark">Round {round.index + 1} / {round.total}</span>
        {round.multiplier > 1 && <span className="chip chip-yellow anim-pulse">× {round.multiplier} POINTS</span>}
        <span className="chip" style={{ background: cat.color }}>{cat.emoji} {cat.name}</span>
      </div>
      <div className="intro-card card anim-pop">
        <div className="intro-hero">
          <div className="intro-emoji anim-float">{meta.emoji}</div>
          <div>
            <h1 className="intro-name">{meta.name}</h1>
            <p className="intro-tag">{meta.tagline}</p>
          </div>
        </div>
        <ol className="intro-steps">
          {meta.instructions.map((s, i) => (
            <li key={i} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>{s}</li>
          ))}
        </ol>
        <div className="intro-controls">
          {meta.controls.map((c) => <span key={c} className="chip">{CONTROL_LABEL[c]}</span>)}
          {meta.teams && <span className="chip chip-blue">🤝 Team game</span>}
        </div>
        {meta.needsSound && sfxMuted && (
          <div className="intro-warn">
            🔊 This game needs sound! <button className="btn btn-yellow btn-sm" onClick={() => updateSettings({ sfxMuted: false })}>Turn sound on</button>
          </div>
        )}
        {meta.orientation === 'landscape' && portrait && isTouchDevice() && <div className="intro-warn">📱↻ Tip: rotate your phone sideways for this one.</div>}
      </div>

      <div className="intro-bottom">
        {secs <= 3 && secs > 0 ? (
          <div key={secs} className="big-count">{secs}</div>
        ) : (
          <>
            {meMember?.status === 'spectating' ? (
              <span className="chip chip-dark">👀 You join next round — enjoy the show!</span>
            ) : (
              <button className={`btn ${meMember?.ready ? 'btn-green' : 'btn-pink'} btn-xl`} onClick={() => { sfx('correct'); emit('room:skip'); }} disabled={meMember?.ready}>
                {meMember?.ready ? '✓ Ready!' : "Got it! Let's go"}
              </button>
            )}
            <div className="intro-wait">
              <span className="g-secs">{secs}</span>
              {waiting.length > 0 && (
                <span className="row-nw small">
                  waiting for {waiting.slice(0, 5).map((m) => <Avatar key={m.id} avatar={m.avatar} size={22} />)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
