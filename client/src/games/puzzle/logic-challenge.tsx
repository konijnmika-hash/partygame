import './puzzle.css';
import type { GameViewProps } from '../../game/types';
import { QuizView, type QuizPub } from '../../game/QuizView';

interface Prompt {
  kind: 'seq' | 'emoji' | 'odd' | 'letters';
  q: string;
  items: string[];
}

export default function LogicChallenge(props: GameViewProps<QuizPub<Prompt, string>>) {
  return (
    <QuizView
      {...props}
      cols={4}
      renderPrompt={(p) => (
        <div className="g-prompt">
          <small>{p.q}</small>
          <div className="seq-row">
            {p.items.map((it, i) => (
              <span key={i} className={`seq-item ${it === '?' ? 'q' : ''} ${p.kind === 'emoji' ? 'emo' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
                {it}
              </span>
            ))}
          </div>
        </div>
      )}
      renderChoice={(c) => <span className={props.pub.q?.prompt.kind === 'emoji' ? 'emoji-big' : ''}>{c}</span>}
    />
  );
}
