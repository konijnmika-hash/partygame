import './team.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameViewProps } from '../../game/types';
import { createRng } from '@shared/rng';
import { SecondsLeft } from '../../game/kit';
import { teamName } from '@shared/teams';
import { subscribeGameEvents } from '../../state/store';
import { TeamBar, myTeam } from './_team';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub { seed: number; n: number; boards: number[][]; teams: string[][]; finished: (number | null)[]; endsAt: number }

const PIC = 600;
const EMOJI = ['🐙', '🦊', '🐳', '🌋', '🚀', '🦄', '🐢', '🍉', '🦁', '🌈', '🐸', '🍄'];

/** Paint an original, colourful scene from the seed (same picture for everyone). */
function paintPicture(seed: number): HTMLCanvasElement {
  const r = createRng(seed);
  const cv = document.createElement('canvas');
  cv.width = PIC;
  cv.height = PIC;
  const ctx = cv.getContext('2d')!;
  const h = Math.floor(r.next() * 360);
  const g = ctx.createLinearGradient(0, 0, PIC, PIC);
  g.addColorStop(0, `hsl(${h} 85% 70%)`);
  g.addColorStop(1, `hsl(${(h + 140) % 360} 80% 55%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PIC, PIC);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `hsla(${Math.floor(r.next() * 360)} 90% 65% / 0.55)`;
    ctx.beginPath();
    ctx.arc(r.next() * PIC, r.next() * PIC, 30 + r.next() * 90, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 10;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, r.next() * PIC);
    ctx.bezierCurveTo(PIC / 3, r.next() * PIC, (PIC * 2) / 3, r.next() * PIC, PIC, r.next() * PIC);
    ctx.stroke();
  }
  ctx.font = `${PIC * 0.42}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(EMOJI[Math.floor(r.next() * EMOJI.length)], PIC / 2, PIC / 2 + 10);
  for (let i = 0; i < 6; i++) {
    ctx.font = `${50 + r.next() * 40}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(EMOJI[Math.floor(r.next() * EMOJI.length)], 60 + r.next() * (PIC - 120), 60 + r.next() * (PIC - 120));
  }
  return cv;
}

function Piece({ pic, id, n }: { pic: HTMLCanvasElement; id: number; n: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const s = PIC / n;
    cv.width = s;
    cv.height = s;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(pic, (id % n) * s, Math.floor(id / n) * s, s, s, 0, 0, s, s);
  }, [pic, id, n]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', borderRadius: 6, display: 'block' }} />;
}

function Preview({ pic }: { pic: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    cv.width = 120;
    cv.height = 120;
    cv.getContext('2d')!.drawImage(pic, 0, 0, 120, 120);
  }, [pic]);
  return <canvas ref={ref} style={{ width: 72, height: 72, borderRadius: 10, boxShadow: '0 3px 0 rgba(0,0,0,.25)' }} />;
}

export default function CoopPuzzle({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const pic = useMemo(() => paintPicture(pub.seed), [pub.seed]);
  const mine = myTeam(pub.teams, me);
  const board = pub.boards[Math.max(0, mine)] ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const done = mine >= 0 && pub.finished[mine] != null;
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { team: number };
    if (ev.type === 'solved') sfx(d.team === mine ? 'win' : 'ding');
  }, false), [mine]);
  useEffect(() => {
    if (sel != null && board[sel] === sel) setSel(null);
  }, [board]);
  const tapCell = (i: number) => {
    if (!isPlayer || done || board[i] === i) return;
    if (sel == null) {
      setSel(i);
      sfx('select');
      return;
    }
    if (sel === i) {
      setSel(null);
      return;
    }
    send({ t: 'swap', a: sel, b: i });
    sfx('swap');
    vibrate(8);
    setSel(null);
  };
  const correct = (b: number[]) => b.filter((p, i) => p === i).length;
  const total = pub.n * pub.n;
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.boards.map(correct)} me={me} players={players} fmt={(v) => `${v}/${total}`} />
      <div className="row-nw" style={{ gap: 10 }}>
        <SecondsLeft deadline={pub.endsAt} />
        <b>{done ? `🎉 Team ${teamName(mine)} solved it! (#${pub.finished[mine]})` : 'Tap two pieces to swap them'}</b>
      </div>
      <div className="tgrid" style={{ gridTemplateColumns: `repeat(${pub.n}, 1fr)`, width: 'min(92vw, 520px, 58dvh)' }}>
        {board.map((p, i) => (
          <button key={i} className={`tcell ${p === i ? 'locked' : ''} ${sel === i ? 'sel' : ''}`} onClick={() => tapCell(i)} aria-label={`Piece ${i + 1}`}>
            <Piece pic={pic} id={p} n={pub.n} />
          </button>
        ))}
      </div>
      <div className="row-nw" style={{ gap: 10 }}>
        <Preview pic={pic} />
        <div className="small" style={{ maxWidth: 260 }}>Your teammates are working on this same board — locked pieces glow green. The small picture shows the goal.</div>
      </div>
    </div>
  );
}
