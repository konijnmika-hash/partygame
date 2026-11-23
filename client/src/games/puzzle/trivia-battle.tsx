import type { GameViewProps } from '../../game/types';
import { QuizView, type QuizPub } from '../../game/QuizView';

export default function TriviaBattle(props: GameViewProps<QuizPub<{ q: string; topic: string }, string>>) {
  return (
    <QuizView
      {...props}
      renderPrompt={(p) => (
        <div className="g-prompt">
          <small>{p.topic}</small>
          {p.q}
        </div>
      )}
    />
  );
}
