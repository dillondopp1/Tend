import type { GameId } from '../lib/api';
import type { Game, GameOpts } from './engine';
import { createGlide } from './glide';
import { createCatch } from './catch';
import { createStack } from './stack';
import { createDash } from './dash';
import { createGather } from './gather';
import { createRun } from './run';
import { createLaunch } from './launch';
import { createSlice } from './slice';

export interface GameInfo { id: GameId; name: string; emoji: string; blurb: string; create: (o: GameOpts) => Game; landscape?: boolean }

export const GAMES: GameInfo[] = [
  { id: 'run', name: 'Run', emoji: '🏃‍♀️', blurb: 'Swipe to dodge, grab the words', create: createRun },
  { id: 'launch', name: 'Launch', emoji: '🎯', blurb: 'Sling your pet at the word towers (turn your phone sideways)', create: createLaunch, landscape: true },
  { id: 'slice', name: 'Slice', emoji: '⚔️', blurb: 'Swipe to slice the words', create: createSlice },
  { id: 'glide', name: 'Glide', emoji: '🪽', blurb: 'Tap to flap through the gaps', create: createGlide },
  { id: 'catch', name: 'Catch', emoji: '🧺', blurb: 'Catch the good stuff, dodge the storms', create: createCatch },
  { id: 'stack', name: 'Stack', emoji: '🧱', blurb: 'Drop blocks and build it high', create: createStack },
  { id: 'dash', name: 'Dash', emoji: '🦘', blurb: 'Run and jump. Hold for a big jump', create: createDash },
  { id: 'gather', name: 'Gather', emoji: '🍎', blurb: 'Match 3 in 60 seconds', create: createGather },
];

export const gameInfo = (id: string) => GAMES.find((g) => g.id === id);
