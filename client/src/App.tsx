import { useEffect, lazy, Suspense } from 'react';
import { GAME_MAP } from '@shared/catalog/index';
import { useStore } from './state/store';
import { Background } from './components/Background';
import { Toasts } from './components/Toasts';
import { Logo, Spinner } from './components/ui';
import { playMusic } from './audio/music';
import { Home } from './screens/Home';
import { RoomScreen } from './screens/RoomScreen';

const Leaderboard = lazy(() => import('./screens/Leaderboard'));
const Profile = lazy(() => import('./screens/Profile'));
const Friends = lazy(() => import('./screens/Friends'));
const Catalog = lazy(() => import('./screens/Catalog'));
const Settings = lazy(() => import('./screens/Settings'));

function useMusic() {
  const screen = useStore((s) => s.screen);
  const phase = useStore((s) => s.room?.phase);
  const gameId = useStore((s) => s.room?.round?.gameId);
  const muted = useStore((s) => s.settings.musicMuted || s.settings.musicVolume <= 0);
  useEffect(() => {
    if (muted) return playMusic(null);
    let track: 'lobby' | 'game' | 'final' | null = 'lobby';
    if (screen === 'room' && phase) {
      if (phase === 'playing') track = gameId && GAME_MAP[gameId]?.needsSound ? null : 'game';
      else if (phase === 'intro') track = 'game';
      else if (phase === 'final') track = 'final';
      else track = 'lobby';
    }
    const start = () => playMusic(track);
    start();
    // browsers need a user gesture before audio can play
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, [screen, phase, gameId, muted]);
}

export function App() {
  const profile = useStore((s) => s.profile);
  const authError = useStore((s) => s.authError);
  const screen = useStore((s) => s.screen);
  const room = useStore((s) => s.room);
  const connected = useStore((s) => s.connected);
  const everConnected = useStore((s) => s.everConnected);
  useMusic();

  let body;
  if (!profile) {
    body = (
      <div className="splash">
        <Logo size={1.4} />
        <Spinner />
        <p className="muted">{authError ? `${authError} — retrying...` : 'Inflating party balloons...'}</p>
      </div>
    );
  } else if (screen === 'room' && room) body = <RoomScreen />;
  else {
    body = (
      <Suspense fallback={<div className="splash"><Spinner /></div>}>
        {screen === 'leaderboard' ? <Leaderboard /> : screen === 'profile' ? <Profile /> : screen === 'friends' ? <Friends /> : screen === 'catalog' ? <Catalog /> : screen === 'settings' ? <Settings /> : <Home />}
      </Suspense>
    );
  }
  return (
    <>
      <Background />
      {body}
      {profile && everConnected && !connected && (
        <div className="conn-banner" role="status">
          <span className="dots"><i /><i /><i /></span> Connection lost — reconnecting...
        </div>
      )}
      <Toasts />
    </>
  );
}
