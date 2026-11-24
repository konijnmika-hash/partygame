import { Component, Suspense, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { GAME_MAP } from '@shared/catalog/index';
import { CATEGORY_MAP } from '@shared/categories';
import type { InputFrame } from '@shared/types';
import { useStore } from '../state/store';
import { emit } from '../net/socket';
import { forgetView, getView, isChunkLoadError } from '../game/registry';
import type { GameViewProps } from '../game/types';
import { SoundToggles } from '../components/TopBar';
import { CountUp, Spinner } from '../components/ui';
import { EmoteBar } from './RoomScreen';

class GameErrorBoundary extends Component<{ children: ReactNode; gameId: string }, { err: Error | null }> {
  override state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  override componentDidCatch(err: Error) {
    console.error('game view crashed', err);
  }
  override render() {
    const err = this.state.err;
    if (err) {
      // the game's code could not be downloaded: after a site update the old files are gone,
      // so only a fresh page load helps (the room reconnects by itself)
      const stale = isChunkLoadError(err);
      return (
        <div className="g-stage centered">
          <div className="glass center stack">
            <h2>{stale ? 'Could not load this game 📡' : 'Oops! This game hiccuped 😵'}</h2>
            <p className="muted small">
              {stale
                ? 'The connection dropped or Bloop Bash was just updated. Reload the page to get the latest version.'
                : 'Your progress is safe. Try reloading the view.'}
            </p>
            {stale ? (
              <button className="btn btn-pink" onClick={() => window.location.reload()}>Reload page</button>
            ) : (
              <button
                className="btn btn-pink"
                onClick={() => {
                  forgetView(this.props.gameId);
                  this.setState({ err: null });
                  emit('game:sync');
                }}
              >
                Reload game view
              </button>
            )}
            <p className="muted tiny">{this.props.gameId}: {String(err.message || err).slice(0, 140)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function GameScreen() {
  const room = useStore((s) => s.room!);
  const me = useStore((s) => s.profile!.id);
  const game = useStore((s) => s.game);
  const gameId = room.round!.gameId;
  const meta = GAME_MAP[gameId];
  const cat = CATEGORY_MAP[meta.category];
  const View = useMemo(() => getView(gameId), [gameId]);
  const meMember = room.members.find((m) => m.id === me);
  const isPlayer = !!meMember && meMember.status !== 'spectating';

  // if the view mounted before any state arrived (e.g. late chunk load), ask for a resync
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useStore.getState().game.pub) emit('game:sync');
    }, 1500);
    return () => clearTimeout(t);
  }, [gameId]);

  const send = useCallback((a: Record<string, unknown>) => emit('game:action', a), []);
  const input = useCallback((f: InputFrame) => emit('game:input', [f.x, f.y, f.b]), []);
  const player = useCallback((id: string) => room.members.find((m) => m.id === id), [room.members]);

  const props: GameViewProps = {
    meta,
    pub: game.pub,
    priv: game.priv,
    pubT: game.pubT,
    me,
    isPlayer,
    players: room.members,
    player,
    send,
    input,
    assets: game.assets,
  };

  return (
    <div className="game-shell" style={{ ['--g1' as any]: cat.gradient[0], ['--g2' as any]: cat.gradient[1] }}>
      <header className="hud">
        <div className="hud-left">
          <span className="hud-round">{room.round!.index + 1}/{room.round!.total}</span>
          <span className="hud-name"><span className="hud-emoji">{meta.emoji}</span> {meta.name}</span>
        </div>
        <div className="hud-right">
          {!room.settings.rules.hideScores && meMember && (
            <span className="hud-points" title="Your party points"><CountUp value={meMember.score} /> pts</span>
          )}
          <EmoteBar compact />
          <SoundToggles />
        </div>
      </header>
      {!isPlayer && <div className="spectate-banner">👀 Spectating — you will join from the next round</div>}
      <main className="game-main">
        <GameErrorBoundary key={gameId} gameId={gameId}>
          <Suspense fallback={<div className="g-stage centered"><Spinner /></div>}>
            {View && game.gameId === gameId && game.pub != null ? <View {...props} /> : <div className="g-stage centered"><Spinner /></div>}
          </Suspense>
        </GameErrorBoundary>
      </main>
    </div>
  );
}
