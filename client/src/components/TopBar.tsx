import type { ReactNode } from 'react';
import { go, useStore } from '../state/store';
import { updateSettings } from '../boot';
import { sfx } from '../audio/sfx';

export function SpeakerIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {off ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

export function NoteIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M9 18V6l11-2v12" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.8" fill="currentColor" />
      <circle cx="17.5" cy="16" r="2.8" fill="currentColor" />
      {off && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

export function SoundToggles() {
  const s = useStore((st) => st.settings);
  return (
    <div className="row-nw sound-toggles">
      <button
        className={`btn btn-ghost btn-icon btn-sm ${s.sfxMuted ? '' : 'on'}`}
        aria-label={s.sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
        title="Sound effects"
        onClick={() => {
          updateSettings({ sfxMuted: !s.sfxMuted });
          if (s.sfxMuted) setTimeout(() => sfx('pop'), 30);
        }}
      >
        <SpeakerIcon off={s.sfxMuted} />
      </button>
      <button
        className={`btn btn-ghost btn-icon btn-sm ${s.musicMuted ? '' : 'on'}`}
        aria-label={s.musicMuted ? 'Unmute music' : 'Mute music'}
        title="Music"
        onClick={() => updateSettings({ musicMuted: !s.musicMuted })}
      >
        <NoteIcon off={s.musicMuted} />
      </button>
    </div>
  );
}

export function TopBar({ title, back = true, right }: { title?: ReactNode; back?: boolean; right?: ReactNode }) {
  return (
    <header className="topbar">
      {back ? (
        <button className="btn btn-ghost btn-sm" onClick={() => { sfx('click'); go('home'); }} aria-label="Back to home">
          ← Back
        </button>
      ) : <span />}
      {title && <h2 className="topbar-title">{title}</h2>}
      <div className="row-nw">
        {right}
        <SoundToggles />
      </div>
    </header>
  );
}
