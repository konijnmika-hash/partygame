import type { GameDef } from '../../engine/types';
import { drawGuess, blindDrawing } from './drawGuess';
import { eyesClosed, memoryDraw } from './traceGames';
import { speedSketch } from './speedSketch';
import { guessDoodle } from './guessDoodle';
import { drawingRelay } from './drawingRelay';
import { fakeArtist } from './fakeArtist';
import { pixelGuess } from './pixelGuess';
import { draw10 } from './draw10';

export const DRAWING_GAMES: GameDef[] = [
  drawGuess, speedSketch, blindDrawing, eyesClosed, guessDoodle, drawingRelay, fakeArtist, memoryDraw, pixelGuess, draw10,
];
