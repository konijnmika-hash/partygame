import './arcade.css';
import { useEffect } from 'react';
import type { GameViewProps } from '../../game/types';
import { ArenaCanvas } from '../../game/ArenaCanvas';
import { drawBloop, emoji, roundRect, text } from '../../game/canvas';
import { TouchControls } from '../../game/Joystick';
import { useInputStream } from '../../game/input';
import { MiniScores, RankPill } from '../../game/kit';
import { subscribeGameEvents } from '../../state/store';
import { nm } from '../social/_kit';
import { sfx, vibrate } from '../../audio/sfx';

interface Pub {
  round: number;
  rounds: number;
  phase: 'count' | 'play' | 'break' | 'over';
  phaseEnds: number;
  p: { id: string; x: number; y: number; z: number }[];
  fx: { x: number; y: number; at: number }[];
  humans: number;
  survivor: string | null;
  scores: Record<string, number>;
}

export default function ZombieTag({ pub, pubT, me, isPlayer, input, players, player }: GameViewProps<Pub>) {
  useInputStream(input, isPlayer);
  useEffect(() => subscribeGameEvents((ev) => {
    const d = ev.data as { id?: string; by?: string; survivor?: string | null };
    if (ev.type === 'infect') {
      sfx(d.id === me ? 'lose' : 'buzz', 0.8);
      if (d.id === me) vibrate([150, 60, 150]);
    }
    if (ev.type === 'round') sfx(d.survivor === me ? 'win' : 'pop');
  }, false), [me]);
  const meZ = pub.p.find((p) => p.id === me)?.z;
  return (
    <div className="g-stage full" style={{ position: 'relative' }}>
      <ArenaCanvas
        pub={pub}
        pubT={pubT}
        world={{ w: 1200, h: 800 }}
        draw={(ctx, d) => {
          const s = d.s as Pub;
          ctx.fillStyle = '#1e2a1a';
          roundRect(ctx, 0, 0, 1200, 800, 24);
          ctx.fill();
          ctx.fillStyle = 'rgba(126,217,87,0.07)';
          for (let i = 0; i < 18; i++) {
            ctx.beginPath();
            ctx.arc((i * 211) % 1200, (i * 137) % 800, 60, 0, Math.PI * 2);
            ctx.fill();
          }
          for (const p of s.p) {
            const m = player(p.id);
            if (p.z) {
              ctx.fillStyle = 'rgba(126,217,87,0.35)';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 36, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBloop(ctx, p.x, p.y, 26, m?.avatar, { name: m?.name, me: p.id === me, mood: p.z ? 'sad' : 'shock', alpha: p.z ? 0.85 : 1 });
            if (p.z) emoji(ctx, '🧟', p.x + 22, p.y - 30, 26);
          }
          for (const f of s.fx) {
            const age = (d.t - f.at) / 800;
            if (age >= 0 && age <= 1) text(ctx, 'INFECTED!', f.x, f.y - 50 - age * 30, 26, '#7ed957');
          }
          if (s.phase === 'count') text(ctx, `Round ${s.round + 1}/${s.rounds} — RUN!`, 600, 200, 56, '#fff');
          if (s.phase === 'break') text(ctx, s.survivor ? `${s.survivor === me ? 'You are' : `${nm(players, s.survivor)} is`} the last human!` : 'Time! The humans hold out', 600, 200, 46, '#ffd23f');
        }}
      />
      <div className="ph-hud">
        <MiniScores players={players} scores={pub.scores} me={me} limit={5} />
        <RankPill scores={pub.scores} me={me} />
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <span className="ph-pill">Round {pub.round + 1}/{pub.rounds}</span>
          <span className={`ph-pill ${meZ ? '' : 'gold'}`}>{meZ ? '🧟 You are a zombie!' : `🧍 ${pub.humans} humans left`}</span>
        </div>
      </div>
      {isPlayer && <TouchControls a={meZ ? 'LUNGE' : 'DASH'} />}
    </div>
  );
}
