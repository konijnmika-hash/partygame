// Central server-side minigame registry. Each category folder exports its game definitions.
import type { GameDef } from '../engine/types';
import { REACTION_GAMES } from './reaction/index';
import { PUZZLE_GAMES } from './puzzle/index';
import { MEMORY_GAMES } from './memory/index';
import { SOCIAL_GAMES } from './social/index';
import { DRAWING_GAMES } from './drawing/index';
import { PHYSICS_GAMES } from './physics/index';
import { RACING_GAMES } from './racing/index';
import { TEAM_GAMES } from './team/index';
import { WEIRD_GAMES } from './weird/index';
import { ARCADE_GAMES } from './arcade/index';

export const GAME_DEFS: GameDef[] = [...REACTION_GAMES, ...PUZZLE_GAMES, ...MEMORY_GAMES, ...SOCIAL_GAMES, ...DRAWING_GAMES, ...PHYSICS_GAMES, ...RACING_GAMES, ...TEAM_GAMES, ...WEIRD_GAMES, ...ARCADE_GAMES];
