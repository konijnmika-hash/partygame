import './memory.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown, PlayerStrip, RoundDots, Stage, useKeys, useSwipe } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { subscribeGameEvents } from '../../state/store';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  round: number;
  n: number;
  phase: 'cmd' | 'result';
  text: string;
  len: number;
  deadline: number;
  shownAt: number;
  simon: boolean | null;
  verdict: Record<string, string>;
  lives: Record<string, number>;
  score: Record<string, number>;
  alive: string[];
}

const SIMON = { color: 'c-midnight', eyes: 'e-robot', mouth: 'm-mustache', hat: 'h-tophat', acc: 'a-bowtie' };
const COLORS: [string, string][] = [['red', '#ff4f5f'], ['blue', '#3da9fc'], ['green', '#34cf78'], ['yellow', '#ffd23f']];

export default function SimonSays({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { done: number; verdict: string | null }>) {
  const [flash, setFlash] = useState<string | null>(null);
  const downAt = useRef(0);
  const lastTap = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const out = (pub.lives[me] ?? 0) <= 0;
  const can = isPlayer && !out && pub.phase === 'cmd' && !priv?.verdict;
  const doStep = (s: string) => {
    if (!can) return;
    send({ t: 'do', s });
    vibrate(10);
  };
  useEffect(() => {
    if (pub.phase === 'cmd') sfx('blip');
  }, [pub.round, pub.phase]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'ok') { sfx('correct'); setFlash('ok'); }
    if (ev.type === 'fail') { sfx('wrong'); setFlash('fail'); }
    if (ev.type === 'trap') { sfx('lose'); setFlash('trap'); }
  }, false), []);
  useEffect(() => setFlash(null), [pub.round]);
  const swipe = useSwipe((d) => doStep(d));
  useKeys((k) => {
    const map: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', '1': 'red', '2': 'blue', '3': 'green', '4': 'yellow' };
    if (map[k]) doStep(map[k]);
  }, can);
  const myVerdict = pub.phase === 'result' ? pub.verdict[me] : null;
  return (
    <Stage>
      <RoundDots total={pub.n} current={pub.round} />
      <Countdown deadline={pub.phase === 'cmd' ? pub.deadline : null} total={pub.deadline - pub.shownAt} />
      <div className="simon-head">
        <Avatar avatar={SIMON} size={74} bob />
        <div className="simon-bubble anim-pop" key={pub.round}>{pub.text}</div>
      </div>
      {pub.phase === 'result' ? (
        <Banner
          title={pub.simon ? 'Simon DID say!' : 'Simon did NOT say! 😈'}
          sub={myVerdict === 'ok' ? 'You did it! ✅' : myVerdict === 'safe' ? 'You stayed still — nice! ✅' : myVerdict === 'trap' ? 'You fell for it! 💔' : myVerdict === 'fail' ? 'Wrong move! 💔' : ''}
          tone={myVerdict === 'ok' || myVerdict === 'safe' ? 'good' : 'bad'}
        />
      ) : out ? (
        <Banner title="You're out of lives 💀" sub="Watch the others squirm" />
      ) : (
        <Banner title={priv?.verdict === 'ok' ? 'Done! ✅' : flash === 'fail' || flash === 'trap' ? 'Oops! 💔' : `Step ${Math.min(pub.len, (priv?.done ?? 0) + 1)} of ${pub.len}`} sub="Only obey if it starts with “Simon says”" />
      )}
      <div className={`simon-pad ${can ? '' : 'off'}`}>
        <div className="simon-colors">
          {COLORS.map(([id, hex]) => (
            <button key={id} className="simon-color" style={{ background: hex }} disabled={!can} onPointerDown={(e) => { e.preventDefault(); sfx('tap'); doStep(id); }}>{id.toUpperCase()}</button>
          ))}
        </div>
        <div className="simon-swipe" {...(can ? swipe : {})}>
          <span>Swipe area ↕↔</span>
          <small>(or arrow keys)</small>
        </div>
        <button
          className="simon-big"
          disabled={!can}
          onPointerDown={(e) => {
            e.preventDefault();
            downAt.current = performance.now();
            holdTimer.current = window.setTimeout(() => {
              holdTimer.current = null;
              sfx('ding');
              doStep('hold');
            }, 700);
          }}
          onPointerUp={() => {
            if (holdTimer.current == null) return; // was a hold
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
            const now = performance.now();
            if (now - lastTap.current < 380) {
              lastTap.current = 0;
              sfx('pop');
              doStep('double');
            } else lastTap.current = now;
          }}
        >
          BIG BUTTON
          <small>hold / double-tap</small>
        </button>
      </div>
      <PlayerStrip players={players} ids={Object.keys(pub.lives)} size={28} dim={(id) => pub.lives[id] <= 0} badge={(id) => '❤️'.repeat(Math.max(0, pub.lives[id]))} />
    </Stage>
  );
}
