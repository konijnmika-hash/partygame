import './team.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { DIRS } from '@shared/maze';
import { applyView, drawBloop, fitWorld, roundRect, text } from '../../game/canvas';
import { Countdown, useKeys } from '../../game/kit';
import { teamColor, teamName } from '@shared/teams';
import { subscribeGameEvents } from '../../state/store';
import { TeamBar, myTeam } from './_team';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  i: number;
  n: number;
  phase: 'run' | 'done';
  deadline: number;
  maze: { w: number; h: number; cells: number[]; exit: number } | null;
  teams: string[][];
  owners: string[][][];
  pos: number[];
  finished: (number | null)[];
  teamScores: number[];
}

const CELL = 60;
const ARROWS = ['▲', '▶', '▼', '◀'];
const KEYMAP: Record<string, number> = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };

export default function SharedMaze({ pub, me, isPlayer, send, players }: GameViewProps<Pub>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pubRef = useRef(pub);
  pubRef.current = pub;
  const mine = myTeam(pub.teams, me);
  const owners = mine >= 0 ? pub.owners[mine] : [[], [], [], []];
  const canMove = isPlayer && pub.phase === 'run' && mine >= 0 && pub.finished[mine] == null;
  const move = (d: number) => {
    if (!canMove || !owners[d].includes(me)) {
      if (canMove) sfx('buzz', 0.6);
      return;
    }
    const m = pub.maze!;
    if (!(m.cells[pub.pos[mine]] & DIRS[d].bit)) {
      sfx('buzz', 0.6);
      return;
    }
    sfx('tap', 1.2);
    vibrate(8);
    send({ t: 'mv', d });
  };
  useKeys((k, e) => {
    if (KEYMAP[k] != null) {
      e.preventDefault();
      move(KEYMAP[k]);
    }
  }, canMove);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { team: number };
    if (ev.type === 'exit') sfx(d.team === mine ? 'win' : 'ding');
  }, false), [mine]);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const frame = () => {
      const p = pubRef.current;
      const m = p.maze;
      if (m) {
        const Wd = m.w * CELL;
        const Hd = m.h * CELL;
        const view = fitWorld(cv, Wd + 20, Hd + 20, 4);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        applyView(ctx, view);
        ctx.translate(10, 10);
        ctx.fillStyle = '#f4f0ff';
        roundRect(ctx, -6, -6, Wd + 12, Hd + 12, 14);
        ctx.fill();
        const ex = (m.exit % m.w) * CELL;
        const ey = Math.floor(m.exit / m.w) * CELL;
        ctx.fillStyle = '#7af0a8';
        ctx.fillRect(ex + 4, ey + 4, CELL - 8, CELL - 8);
        text(ctx, '🏁', ex + CELL / 2, ey + CELL / 2, 32);
        ctx.strokeStyle = '#3b2e6e';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let c = 0; c < m.cells.length; c++) {
          const x = (c % m.w) * CELL;
          const y = Math.floor(c / m.w) * CELL;
          const v = m.cells[c];
          if (!(v & 1)) { ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); }
          if (!(v & 8)) { ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); }
          if (Math.floor(c / m.w) === m.h - 1 && !(v & 4)) { ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); }
          if (c % m.w === m.w - 1 && !(v & 2)) { ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); }
        }
        ctx.stroke();
        p.pos.forEach((c, t) => {
          const lead = players.find((x) => x.id === p.teams[t][0]);
          const x = (c % m.w) * CELL + CELL / 2 + (t - (p.pos.length - 1) / 2) * 8;
          const y = Math.floor(c / m.w) * CELL + CELL / 2;
          drawBloop(ctx, x, y, t === myTeam(p.teams, me) ? 20 : 15, lead?.avatar, { ring: teamColor(t), alpha: t === myTeam(p.teams, me) ? 1 : 0.55 });
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [players.length]);
  return (
    <div className="g-stage">
      <TeamBar teams={pub.teams} scores={pub.teamScores} me={me} players={players} />
      <div className="mz-top">
        <span className="ph-pill">Maze {pub.i + 1}/{pub.n}</span>
        <span style={{ flex: 1, minWidth: 100 }}><Countdown deadline={pub.phase === 'run' ? pub.deadline : null} total={60000} /></span>
        {mine >= 0 && pub.finished[mine] != null && <span className="ph-pill gold">🏁 #{pub.finished[mine]}</span>}
      </div>
      <div className="mz-box" style={{ minHeight: 220 }}>
        <canvas ref={ref} />
      </div>
      {isPlayer && mine >= 0 && (
        <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
          <div className="small">You steer Team {teamName(mine)} — only the arrows you own work!</div>
          <div className="dpad">
            {[0, 3, 1, 2].map((d) => {
              const own = owners[d].includes(me);
              const who = owners[d].filter((id) => id !== me).map((id) => nm(players, id)).join(', ');
              return (
                <button key={d} className={`dpad-btn dp-${['up', 'right', 'down', 'left'][d]}`} disabled={!canMove || !own} onPointerDown={(e) => { e.preventDefault(); move(d); }} title={own ? 'Yours' : `${who}'s`}>
                  {own ? ARROWS[d] : <small style={{ fontSize: '0.6rem', lineHeight: 1 }}>{who.split(' ')[0] || '—'}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
