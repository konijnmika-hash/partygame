import './weird.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { Avatar } from '../../components/ui';
import { Banner, Countdown, RoundDots } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'intro' | 'bid' | 'sold' | 'final';
  hammerAt: number;
  lot: { name: string; emoji: string; desc: string } | null;
  bid: number;
  leader: string | null;
  coins: Record<string, number>;
  won: Record<string, number[]>;
  paid: Record<number, number>;
  lots: { name: string; emoji: string; value?: number }[];
  incs: number[];
}

export default function FakeAuction({ pub, priv, me, isPlayer, send, players, player }: GameViewProps<Pub, { tips: { lot: number; text: string }[] }>) {
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id: string | null; amt: number };
    if (ev.type === 'bid') sfx(d.id === me ? 'coin' : 'tick');
    if (ev.type === 'sold') {
      sfx(d.id ? 'ding' : 'buzz');
      if (d.id === me) vibrate([60, 40, 60]);
    }
  }, false), [me]);
  const myCoins = pub.coins[me] ?? 0;
  const tips = (priv?.tips ?? []).filter((t) => t.lot === pub.i);
  if (pub.phase === 'final') {
    const worth = (id: string) => (pub.coins[id] ?? 0) + (pub.won[id] ?? []).reduce((a, k) => a + (pub.lots[k].value ?? 0), 0);
    const ranked = [...players].filter((p) => pub.coins[p.id] != null).sort((a, b) => worth(b.id) - worth(a.id));
    return (
      <div className="g-stage">
        <Banner title="💰 The appraisals are in!" big />
        <div className="wealth">
          {pub.lots.map((l, k) => {
            const owner = Object.entries(pub.won).find(([, ks]) => ks.includes(k))?.[0];
            return (
              <div key={k} className="wealth-row">
                <span style={{ fontSize: '1.6rem' }}>{l.emoji}</span>
                <span>{l.name}</span>
                <span className="small">{owner ? `${nm(players, owner)} paid ${pub.paid[k]}` : 'unsold'}</span>
                <b style={{ color: (l.value ?? 0) < 0 ? '#ff8a8f' : undefined }}>{l.value}</b>
              </div>
            );
          })}
        </div>
        <div className="wealth">
          {ranked.map((p, i) => (
            <div key={p.id} className="wealth-row" style={p.id === me ? { boxShadow: 'inset 0 0 0 2px #fff' } : undefined}>
              <span>{i + 1}.</span>
              <Avatar avatar={p.avatar} size={28} />
              <span>{p.name}</span>
              <b>{worth(p.id)} 🪙</b>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const leader = pub.leader ? player(pub.leader) : null;
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={Math.max(0, pub.i)} />
      <div className="row-nw" style={{ gap: 8 }}>
        <span className="chip chip-yellow">Your purse: {myCoins} 🪙</span>
        {(pub.won[me] ?? []).length > 0 && <span className="chip chip-dark">Won: {(pub.won[me] ?? []).map((k) => pub.lots[k].emoji).join(' ')}</span>}
      </div>
      {pub.phase === 'intro' ? (
        <Banner title="🔨 Welcome to the Fake Auction!" sub="Some of you have secret appraisal tips. Bid wisely — some lots are worthless!" big />
      ) : pub.lot ? (
        <>
          <div className="lot-card" key={pub.i}>
            <div className="lot-emoji">{pub.lot.emoji}</div>
            <div className="lot-name">{pub.lot.name}</div>
            <div className="lot-desc">{pub.lot.desc}</div>
          </div>
          {tips.map((t, k) => <div key={k} className="tip">🤫 Tip: {t.text}</div>)}
          <div className="bid-now">{pub.bid ? `${pub.bid} 🪙` : 'No bids yet'}</div>
          {leader && <div className="row-nw" style={{ gap: 6 }}><Avatar avatar={leader.avatar} size={28} /><b>{pub.leader === me ? 'You lead!' : `${leader.name} leads`}</b></div>}
          {pub.phase === 'bid' && (
            <>
              <Countdown deadline={pub.hammerAt} total={9000} />
              {isPlayer && (
                <div className="bid-row">
                  {pub.incs.map((inc) => (
                    <button key={inc} className="btn btn-green" disabled={pub.leader === me || pub.bid + inc > myCoins} onClick={() => send({ t: 'bid', inc })}>
                      +{inc}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {pub.phase === 'sold' && <Banner title={pub.leader ? `🔨 SOLD to ${nm(players, pub.leader)} for ${pub.bid}!` : '🔨 No takers!'} tone={pub.leader === me ? 'good' : 'default'} />}
        </>
      ) : null}
    </div>
  );
}
