import type { GameViewProps } from '../../game/types';
import { TraceView } from './_trace';

export default function EyesClosed(props: GameViewProps) {
  return <TraceView {...props} mode="blind" />;
}
