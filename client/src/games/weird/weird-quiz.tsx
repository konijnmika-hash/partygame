import type { GameViewProps } from '../../game/types';
import { QuizView, type QuizPub } from '../../game/QuizView';

export default function WeirdQuiz(props: GameViewProps<QuizPub<{ q: string }, string>>) {
  return (
    <QuizView
      {...props}
      renderPrompt={(p) => (
        <div className="g-prompt">
          <small>🦑 Strange but true</small>
          {p.q}
        </div>
      )}
    />
  );
}
