import './weird.css';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { Banner, Countdown, MiniScores, RoundDots } from '../../game/kit';
import { sfx } from '../../audio/sfx';

interface Pub {
  r: number;
  n: number;
  phase: 'rank' | 'reveal';
  deadline: number;
  q: string;
  items: { name: string; emoji: string }[];
  submitted: string[];
  avg: number[] | null;
  orders: Record<string, number[]> | null;
  gains: Record<string, number> | null;
  scores: Record<string, number>;
}

export default function RidiculousRanking({ pub, priv, me, isPlayer, send, players }: GameViewProps<Pub, { mine: number[] | null }>) {
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3]);
  const [drag, setDrag] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const submitted = !!priv?.mine;
  useEffect(() => {
    setOrder([0, 1, 2, 3]);
    setDrag(null);
  }, [pub.r]);
  useEffect(() => {
    if (pub.phase === 'reveal') sfx((pub.gains?.[me] ?? 0) >= 70 ? 'correct' : 'pop');
  }, [pub.phase]);
  const move = (from: number, to: number) => {
    if (to < 0 || to > 3 || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
    sfx('tick');
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag == null || !listRef.current) return;
    const rows = [...listRef.current.children] as HTMLElement[];
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k].getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom && k !== drag) {
        move(drag, k);
        setDrag(k);
        break;
      }
    }
  };
  const editable = isPlayer && pub.phase === 'rank' && !submitted;
  const shown = pub.phase === 'reveal' && pub.avg ? [0, 1, 2, 3].sort((a, b) => pub.avg![a] - pub.avg![b]) : submitted ? priv!.mine! : order;
  return (
    <div className="g-stage">
      <RoundDots total={pub.n} current={pub.r} />
      <div className="g-prompt"><small>Rank from #1 (most) to #4 (least)</small>{pub.q}</div>
      <Countdown deadline={pub.phase === 'rank' ? pub.deadline : null} total={25000} />
      {pub.phase === 'reveal' && <Banner title="📊 The crowd's ranking" sub={`You earned +${pub.gains?.[me] ?? 0} for matching the group`} />}
      <div className="rank-list" ref={listRef} onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        {shown.map((item, k) => (
          <div
            key={item}
            className={`rank-item ${drag === k ? 'drag' : ''}`}
            onPointerDown={(e) => {
              if (!editable || (e.target as HTMLElement).closest('button')) return;
              (e.currentTarget.parentElement as HTMLElement).setPointerCapture?.(e.pointerId);
              setDrag(k);
            }}
          >
            <span className="num">{k + 1}</span>
            <span className="emo">{pub.items[item]?.emoji}</span>
            <span>{pub.items[item]?.name}</span>
            {editable && (
              <span className="arrows">
                <button onClick={() => move(k, k - 1)} disabled={k === 0} aria-label="Move up">▲</button>
                <button onClick={() => move(k, k + 1)} disabled={k === 3} aria-label="Move down">▼</button>
              </span>
            )}
            {pub.phase === 'reveal' && priv?.mine && <span className="arrows small">you: #{priv.mine.indexOf(item) + 1}</span>}
          </div>
        ))}
      </div>
      {editable && <button className="btn btn-green" onClick={() => { sfx('select'); send({ t: 'rank', order }); }}>Lock in ranking</button>}
      {submitted && pub.phase === 'rank' && <div className="small">Locked in — {pub.submitted.length}/{players.length} ranked</div>}
      <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
    </div>
  );
}
