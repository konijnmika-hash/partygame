import './weird.css';
import { useEffect, useRef } from 'react';
import type { GameViewProps } from '../../game/types';
import { QuizView, type QuizPub } from '../../game/QuizView';
import { serverNow } from '../../net/clock';

type Prompt = { e: string; fx: number; fy: number; zoom: number };

function Zoom({ p, shownAt, deadline, revealed }: { p: Prompt; shownAt: number; deadline: number; revealed: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ shownAt, deadline, revealed });
  live.current = { shownAt, deadline, revealed };
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const frame = () => {
      const S = 400;
      if (cv.width !== S) {
        cv.width = S;
        cv.height = S;
      }
      const { shownAt: t0, deadline: t1, revealed: rv } = live.current;
      // zoom out exponentially from p.zoom to 1 over ~85% of the question time
      const k = rv ? 1 : Math.max(0, Math.min(1, (serverNow() - t0) / ((t1 - t0) * 0.85)));
      const z = Math.pow(p.zoom, 1 - k);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, S, S);
      const base = S * 0.78;
      ctx.translate(S / 2 - p.fx * base * z * (1 - k), S / 2 - p.fy * base * z * (1 - k));
      ctx.scale(z, z);
      ctx.font = `${base}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.e, 0, base * 0.06);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [p.e, p.fx, p.fy, p.zoom]);
  return (
    <div className="zoom-box">
      <canvas ref={ref} />
    </div>
  );
}

export default function MysteryObject(props: GameViewProps<QuizPub<Prompt, string>>) {
  const { pub } = props;
  return (
    <QuizView
      {...props}
      cols={3}
      renderPrompt={(p) => (
        <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
          <div className="small">🔬 What is it? One guess — sooner scores more!</div>
          <Zoom p={p} shownAt={pub.shownAt} deadline={pub.deadline} revealed={pub.phase === 'reveal'} />
        </div>
      )}
    />
  );
}
