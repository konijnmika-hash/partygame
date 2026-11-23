import { useEffect, useRef, useState } from 'react';
import { set, useStore } from '../state/store';
import { emit } from '../net/socket';
import { Lobby } from './Lobby';
import { Intro } from './Intro';
import { GameScreen } from './GameScreen';
import { Results, Standings } from './Results';
import { Final } from './Final';
import { sfx } from '../audio/sfx';

const EMOTES = ['😂', '😮', '😍', '😡', '👏', '🔥', '💀', '🎉', 'GG', '😭', '🤔', '👀'];

export function RoomScreen() {
  const phase = useStore((s) => s.room!.phase);
  useEffect(() => {
    document.body.classList.toggle('in-game', phase === 'playing');
    return () => document.body.classList.remove('in-game');
  }, [phase]);
  return (
    <>
      {phase === 'lobby' && <Lobby />}
      {phase === 'intro' && <Intro />}
      {phase === 'playing' && <GameScreen />}
      {phase === 'results' && <Results />}
      {phase === 'standings' && <Standings />}
      {phase === 'final' && <Final />}
      <FloatingEmotes />
    </>
  );
}

export function FloatingEmotes() {
  const emotes = useStore((s) => s.emotes);
  const members = useStore((s) => s.room?.members ?? []);
  return (
    <div className="float-emotes" aria-hidden="true">
      {emotes.map((e) => {
        const m = members.find((x) => x.id === e.from);
        const left = 10 + ((e.id * 37) % 80);
        return (
          <div key={e.id} className="float-emote" style={{ left: `${left}%` }}>
            <span className="fe-emoji">{e.emote}</span>
            {m && <span className="fe-name">{m.name}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function EmoteBar({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`emote-bar ${compact ? 'compact' : ''}`}>
      {open && (
        <div className="emote-pop">
          {EMOTES.map((e) => (
            <button
              key={e}
              className="emote-btn"
              onClick={() => {
                emit('emote', e);
                sfx('pop');
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen((o) => !o)} aria-label="Send a reaction">
        😀
      </button>
    </div>
  );
}

export function Chat({ className = '' }: { className?: string }) {
  const chat = useStore((s) => s.chat);
  const me = useStore((s) => s.profile?.id);
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
    set({ unreadChat: 0 });
  }, [chat.length]);
  return (
    <div className={`chat ${className}`}>
      <div className="chat-list" ref={list}>
        {chat.length === 0 && <div className="empty tiny">Say hi to the party 👋</div>}
        {chat.map((m) => (
          <div key={m.id} className={`chat-msg ${m.from === 'system' ? 'sys' : ''} ${m.from === me ? 'mine' : ''}`}>
            {m.from !== 'system' && <b>{m.name}: </b>}
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          emit('chat:send', t);
          setText('');
        }}
      >
        <input className="input input-dark" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Chat..." aria-label="Chat message" />
        <button className="btn btn-pink btn-sm" type="submit">Send</button>
      </form>
    </div>
  );
}
