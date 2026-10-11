import type { GameId } from '../lib/api';
import type { Game, GameOpts } from './engine';
import { createGlide } from './glide';
import { createCatch } from './catch';
import { createStack } from './stack';

export interface GameInfo { id: GameId; name: string; emoji: string; blurb: string; create: (o: GameOpts) => Game }

export const GAMES: GameInfo[] = [
  { id: 'glide', name: 'Glide', emoji: '🪽', blurb: 'Tap to flap through the gaps', create: createGlide },
  { id: 'catch', name: 'Catch', emoji: '🧺', blurb: 'Catch the good stuff, dodge the storms', create: createCatch },
  { id: 'stack', name: 'Stack', emoji: '🧱', blurb: 'Drop blocks and build it high', create: createStack },
];

export const gameInfo = (id: string) => GAMES.find((g) => g.id === id);
