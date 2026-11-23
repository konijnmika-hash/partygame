// Shared view for turn-based drawing games (Draw & Guess, Blind Drawing).
import './drawing.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { DrawCanvas } from '../../game/DrawCanvas';
import { Banner, ChoiceGrid, Countdown, MiniScores, TextEntry, useRafNow } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { subscribeGameEvents } from '../../state/store';
import { sfx } from '../../audio/sfx';

interface Pub {
  turn: number;
  turns: number;
  drawer: string;
  phase: 'choose' | 'draw' | 'reveal';
  deadline: number;
  startedAt: number;
  cv: string;
  blind: boolean;
  mask: string | null;
  len: number;
  mc: string[] | null;
  word: string | null;
  guessed: Record<string, number>;
  feed: { from: string; text: string; kind: string }[];
  scores: Record<string, number>;
  players: number;
}
interface Priv {
  options: string[] | null;
  word: string | null;
  lockUntil: number;
}

export function DrawTurnView({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, Priv>) {
  const drawer = player(pub.drawer);
  const iDraw = pub.drawer === me;
  const solved = pub.guessed[me] != null;
  const now = useRafNow();
  const locked = (priv?.lockUntil ?? 0) > now;
  const [close, setClose] = useState<string | null>(null);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'correct') sfx('win');
    if (ev.type === 'close') {
      sfx('blip');
      setClose(`“${(ev.data as any).g}” is close!`);
      setTimeout(() => setClose(null), 2200);
    }
    if (ev.type === 'wrong') sfx('wrong');
  }, false), []);
  useEffect(() => {
    if (pub.phase === 'draw') sfx('go');
    if (pub.phase === 'reveal') sfx('ding');
  }, [pub.phase, pub.turn]);
  const n = Object.keys(pub.guessed).length;

  const header = (
    <div className="dt-head">
      {drawer && <Avatar avatar={drawer.avatar} size={40} />}
      <div className="grow">
        <b>{iDraw ? 'You are drawing!' : `${drawer?.name ?? '???'} is drawing`}</b>
        <div className="tiny muted">Turn {pub.turn + 1}/{pub.turns} · {n} guessed</div>
      </div>
      {pub.phase === 'draw' && pub.mask && <div className="dt-mask">{pub.mask.split('').map((c, i) => <span key={i} className={c === ' ' ? 'gap' : ''}>{c === '_' ? '' : c}</span>)}</div>}
      {iDraw && priv?.word && pub.phase === 'draw' && <span className="chip chip-yellow">Draw: {priv.word}</span>}
    </div>
  );

  if (pub.phase === 'choose') {
    return (
      <div className="g-stage">
        {header}
        <Countdown deadline={pub.deadline} total={9000} />
        {iDraw && priv?.options ? (
          <>
            <Banner title="Pick a word to draw" />
            <ChoiceGrid cols={3} choices={priv.options.map((w) => ({ label: w }))} onPick={(i) => send({ t: 'choose', i })} />
          </>
        ) : (
          <Banner title={`${drawer?.name ?? 'Someone'} is choosing a word...`} sub="Get your guessing fingers ready" />
        )}
        <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
      </div>
    );
  }

  return (
    <div className="g-stage dt-stage">
      {header}
      <Countdown deadline={pub.phase === 'draw' ? pub.deadline : null} total={pub.deadline - pub.startedAt} />
      <div className="dt-main">
        <div className="dt-canvas">
          <DrawCanvas key={pub.cv} cv={pub.cv} me={me} editable={isPlayer && iDraw && pub.phase === 'draw'} blind={pub.blind && iDraw} send={send} />
        </div>
        <div className="dt-side">
          {pub.phase === 'reveal' && <Banner title={`It was “${pub.word}”`} tone="info" />}
          {!pub.blind && (
            <div className="feed">
              {pub.feed.map((f, i) => (
                <div key={i} className={`feed-line ${f.kind}`}>
                  {f.kind === 'guess' && <b>{players.find((p) => p.id === f.from)?.name}: </b>}
                  {f.text}
                </div>
              ))}
            </div>
          )}
          {pub.phase === 'draw' && !iDraw && (
            solved ? (
              <Banner title="You got it! 🎉" sub="Watch the others struggle..." tone="good" />
            ) : pub.blind && pub.mc ? (
              <ChoiceGrid compact cols={2} choices={pub.mc.map((w) => ({ label: w }))} disabled={!isPlayer || locked} onPick={(c) => send({ t: 'pick', c })} />
            ) : (
              <TextEntry disabled={!isPlayer} onSubmit={(g) => send({ t: 'guess', g })} placeholder="Type your guess..." button="Guess" maxLength={40} />
            )
          )}
          {locked && <span className="chip chip-red">❄️ Wrong! Wait a moment...</span>}
          {close && <span className="chip chip-yellow">{close}</span>}
          {iDraw && pub.phase === 'draw' && pub.blind && <span className="chip chip-dark">Your ink is invisible to YOU — trust your hand!</span>}
          <MiniScores players={players} scores={pub.scores} me={me} limit={6} />
        </div>
      </div>
    </div>
  );
}
