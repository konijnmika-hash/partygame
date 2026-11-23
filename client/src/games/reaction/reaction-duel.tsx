import './reaction.css';
import { useEffect, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Stage, TapZone, useChangedAt, nameOf } from '../../game/kit';
import { Avatar } from '../../components/ui';
import { sfx } from '../../audio/sfx';
import { subscribeGameEvents } from '../../state/store';

interface Pair {
  a: string;
  b: string | null;
  wa: number;
  wb: number;
  winner: string | null;
}
interface Pub {
  bracket: number;
  phase: 'standoff' | 'draw' | 'result' | 'bracket';
  word: string;
  drawAt: number;
  pairs: Pair[];
  alive: string[];
  tapped: string[];
  last: { pair: number; winner: string | null; why: string }[];
  need: number;
}

export default function ReactionDuel({ pub, me, isPlayer, send, players, player }: GameViewProps<Pub>) {
  const drawShown = useChangedAt(pub.drawAt);
  const [fault, setFault] = useState(false);
  const myPairIdx = pub.pairs.findIndex((p) => p.a === me || p.b === me);
  const pair = myPairIdx >= 0 ? pub.pairs[myPairIdx] : null;
  const inDuel = !!pair && !!pair.b && !pair.winner;
  const opp = pair ? (pair.a === me ? pair.b : pair.a) : null;
  const myWins = pair ? (pair.a === me ? pair.wa : pair.wb) : 0;
  const oppWins = pair ? (pair.a === me ? pair.wb : pair.wa) : 0;
  useEffect(() => {
    if (pub.phase === 'draw') sfx('boom');
    if (pub.phase === 'standoff') setFault(false);
    if (pub.phase === 'standoff' && pub.word !== 'Ready...' && pub.word !== '...') sfx('tick');
  }, [pub.phase, pub.word]);
  useEffect(() => subscribeGameEvents((ev) => {
    if (ev.type === 'fault') {
      setFault(true);
      sfx('wrong');
    }
  }, false), []);
  const tap = () => {
    if (!inDuel || pub.tapped.includes(me)) return;
    if (pub.phase === 'standoff') send({ t: 'tap', early: true });
    else if (pub.phase === 'draw') {
      send({ t: 'tap', ms: Math.round(performance.now() - drawShown.current) });
      sfx('hit');
    }
  };
  const myResult = pub.last.find((l) => l.pair === myPairIdx);

  if (pub.phase === 'bracket') {
    return (
      <Stage className="centered">
        <Banner title={`🤠 Round ${pub.bracket + 1} showdowns`} sub={`First to ${pub.need} wins advances`} big />
        <div className="duel-bracket">
          {pub.pairs.map((p, i) => (
            <div key={i} className={`duel-pair ${p.a === me || p.b === me ? 'mine' : ''}`}>
              <span>{nameOf(players, p.a)}</span>
              <b>vs</b>
              <span>{p.b ? nameOf(players, p.b) : 'BYE ✨'}</span>
            </div>
          ))}
        </div>
      </Stage>
    );
  }
  const bg = pub.phase === 'draw' ? 'radial-gradient(circle, #ffe27a, #ff8a3d)' : 'radial-gradient(circle, #6b3e1f, #2a1404)';
  return (
    <Stage className="full">
      <TapZone onTap={tap} disabled={!isPlayer || !inDuel} style={{ background: bg, margin: 10, width: 'calc(100% - 20px)' }}>
        {pair && pair.b ? (
          <div className="duel-face">
            <div className="duelist">
              {player(me) && <Avatar avatar={player(me)!.avatar} size={84} mood={pub.phase === 'draw' ? 'shock' : undefined} />}
              <b>You</b>
              <div className="pips">{Array.from({ length: pub.need }, (_, i) => <i key={i} className={i < myWins ? 'on' : ''} />)}</div>
            </div>
            <div className={`duel-word ${pub.phase === 'draw' ? 'draw' : ''}`} key={pub.word}>{pub.word}</div>
            <div className="duelist">
              {opp && player(opp) && <Avatar avatar={player(opp)!.avatar} size={84} />}
              <b>{nameOf(players, opp)}</b>
              <div className="pips">{Array.from({ length: pub.need }, (_, i) => <i key={i} className={i < oppWins ? 'on' : ''} />)}</div>
            </div>
          </div>
        ) : (
          <Banner title={pub.alive.includes(me) ? 'You have a bye! ✨' : 'Eliminated 💀'} sub={pub.alive.includes(me) ? 'Relax while the others duel' : 'Watch the remaining duels'} />
        )}
        {fault && pub.phase !== 'result' && <Banner title="Too early!" sub="You drew before DRAW!" tone="bad" />}
        {pub.phase === 'result' && myResult && <Banner title={myResult.winner === me ? 'You win the showdown! 🎯' : myResult.winner ? `${nameOf(players, myResult.winner)} was faster` : 'Nobody drew!'} sub={myResult.why} tone={myResult.winner === me ? 'good' : 'bad'} />}
        {pair?.winner === me && pub.phase === 'result' && <span className="chip chip-yellow">You advance! 🏆</span>}
        {(!inDuel || pub.phase === 'result') && (
          <div className="duel-bracket small">
            {pub.pairs.filter((p) => p.b).map((p, i) => (
              <div key={i} className="duel-pair">
                <span>{nameOf(players, p.a)} {p.wa}</span><b>–</b><span>{p.wb} {nameOf(players, p.b)}</span>
              </div>
            ))}
          </div>
        )}
      </TapZone>
    </Stage>
  );
}
