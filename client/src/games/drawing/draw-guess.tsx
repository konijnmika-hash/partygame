import type { GameViewProps } from '../../game/types';
import { DrawTurnView } from './_turn';

export default function DrawGuess(props: GameViewProps) {
  return <DrawTurnView {...props} />;
}
