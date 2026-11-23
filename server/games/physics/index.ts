import type { GameDef } from '../../engine/types';
import { wobblyTower } from './wobblyTower';
import { ballBalance, physicsRace, stackObjects } from './ghostGames';
import { bouncyArena } from './bouncyArena';
import { pushButton } from './pushButton';
import { obstacleCourse } from './obstacleCourse';
import { fallingPlatforms } from './fallingPlatforms';
import { balloonSurvival } from './balloonSurvival';
import { physicsPuzzle } from './physicsPuzzle';

export const PHYSICS_GAMES: GameDef[] = [
  wobblyTower, ballBalance, physicsRace, stackObjects, bouncyArena, pushButton, obstacleCourse, fallingPlatforms, balloonSurvival, physicsPuzzle,
];
