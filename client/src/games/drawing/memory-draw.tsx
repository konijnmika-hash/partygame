import type { GameViewProps } from '../../game/types';
import { TraceView } from './_trace';

export default function MemoryDraw(props: GameViewProps) {
  return <TraceView {...props} mode="memory" />;
}
