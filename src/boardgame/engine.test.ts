import { describe, it, expect } from 'vitest';
import { newGame, addPlayer, start, currentId, roll, resolvePending, finishedCount } from './engine';
import { boardFor, HOME_INDEX } from './board';

const p = (id: string) => ({ id, name: id, species: 'fox', color: 0 });

describe('boardgame engine', () => {
  it('rolls, resolves, and rotates turns', () => {
    let g = newGame();
    g = addPlayer(g, p('a'));
    g = addPlayer(g, p('b'));
    g = start(g);
    expect(currentId(g)).toBe('a');
    g = roll(g, 'a', 3);
    // whatever space 3 is, a either moved or has something pending
    if (g.pending) g = resolvePending(g, true);
    expect(currentId(g)).toBe('b');
  });

  it('ignores a roll from someone who is not up', () => {
    let g = newGame();
    g = addPlayer(g, p('a'));
    g = addPlayer(g, p('b'));
    g = start(g);
    const before = g;
    g = roll(g, 'b', 4);
    expect(g).toBe(before);
  });

  it('finishes the game once everyone reaches home', () => {
    const b = boardFor();
    const home = HOME_INDEX(b);
    let g = newGame();
    g = addPlayer(g, p('a'));
    g = start(g);
    let guard = 0;
    while (g.phase !== 'finished' && guard++ < 200) {
      g = roll(g, 'a', 6);
      if (g.pending) g = resolvePending(g, true);
    }
    expect(g.phase).toBe('finished');
    expect(finishedCount(g)).toBe(1);
    expect(g.players[0].pos).toBeGreaterThanOrEqual(home);
  });
});
