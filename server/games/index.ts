// Central server-side minigame registry. Each category folder exports its game definitions.
import type { GameDef } from '../engine/types';
import { REACTION_GAMES } from './reaction/index';

export const GAME_DEFS: GameDef[] = [...REACTION_GAMES];
