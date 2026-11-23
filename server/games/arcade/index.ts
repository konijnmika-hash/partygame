import type { GameDef } from '../../engine/types';
import { paintWar } from './paintWar';
import { neonTrails } from './neonTrails';
import { hungryBlobs } from './hungryBlobs';
import { zombieTag } from './zombieTag';
import { snowballFight } from './snowballFight';
import { sheepHerder } from './sheepHerder';
import { spaceBlaster } from './spaceBlaster';
import { paddleRoyale } from './paddleRoyale';
import { blendIn } from './blendIn';
import { hoverHop, gravityFlip, roadHopper } from './ghostGames';
import { crownChase } from './crownChase';

export const ARCADE_GAMES: GameDef[] = [
  paintWar, neonTrails, hungryBlobs, zombieTag, snowballFight, sheepHerder, spaceBlaster, paddleRoyale, blendIn, roadHopper, hoverHop, gravityFlip, crownChase,
];
