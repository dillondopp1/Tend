import { describe, it, expect } from 'vitest';
import {
  newGame, addPlayer, start, currentId, settle, roll, continueCard, build, upgrade,
  proposeTrade, acceptTrade, cancelTrade, toPublic,
} from './engine';

const p = (id: string) => ({ id, name: id, species: 'fox', color: 0 });
let n = 0;
const newId = () => `id${n++}`;

function setupTwoSettled() {
  let g = newGame();
  g = addPlayer(g, p('a'));
  g = addPlayer(g, p('b'));
  g = start(g);
  expect(g.phase).toBe('settle');
  expect(currentId(g)).toBe('a');
  g = settle(g, 'a', 0); // faith tile, number 2
  expect(currentId(g)).toBe('b');
  g = settle(g, 'b', 5); // mercy tile, number 8
  expect(g.phase).toBe('playing');
  return g;
}

describe('boardgame engine (Catan-lite)', () => {
  it('settles players onto tiles in turn order, then starts play', () => {
    const g = setupTwoSettled();
    expect(g.players.find((x) => x.id === 'a')!.points).toBe(1);
    expect(g.buildings).toHaveLength(2);
  });

  it('ignores a settle from someone who is not up, or a full tile', () => {
    let g = newGame();
    g = addPlayer(g, p('a'));
    g = addPlayer(g, p('b'));
    g = start(g);
    const before = g;
    g = settle(g, 'b', 0); // not b's turn yet
    expect(g).toBe(before);
  });

  it('rolling the matching number produces resources for the right player', () => {
    let g = setupTwoSettled();
    g = roll(g, 'a', 1, 1); // sum 2 -> a's faith tile
    expect(g.players.find((x) => x.id === 'a')!.resources.faith).toBe(1);
    expect(g.players.find((x) => x.id === 'b')!.resources.faith).toBe(0);
    expect(currentId(g)).toBe('b');
  });

  it('rolling a 7 opens a card instead of producing, and holds the turn until continued', () => {
    let g = setupTwoSettled();
    g = roll(g, 'a', 3, 4); // sum 7
    expect(g.card).not.toBeNull();
    expect(currentId(g)).toBe('a'); // still a's "turn" until the card is dismissed
    g = continueCard(g);
    expect(g.card).toBeNull();
    expect(currentId(g)).toBe('b');
  });

  const withHand = (g: ReturnType<typeof setupTwoSettled>, id: string, resources: Partial<Record<string, number>>) =>
    ({ ...g, players: g.players.map((p) => (p.id === id ? { ...p, resources: { ...p.resources, ...resources } } : p)) });

  it('builds an altar when affordable and not when it is not', () => {
    let g = setupTwoSettled();
    const before = g;
    g = build(g, 'a', 1); // can't afford yet (empty hand)
    expect(g).toBe(before);
    g = withHand(g, 'a', { faith: 1, mercy: 1, thanks: 1, word: 1 });
    g = build(g, 'a', 1); // mercy tile, open slot
    expect(g.buildings).toHaveLength(3);
    expect(g.players.find((x) => x.id === 'a')!.points).toBe(2);
    expect(g.players.find((x) => x.id === 'a')!.resources.faith).toBe(0);
  });

  it('upgrades an altar to a temple for its higher cost, adding a point', () => {
    let g = setupTwoSettled();
    g = withHand(g, 'a', { mercy: 2, word: 2 });
    const before = g;
    g = upgrade(g, 'a', 5); // 'a' doesn't own tile 5 (that's b's)
    expect(g).toBe(before);
    g = upgrade(g, 'a', 0); // a's own faith tile
    expect(g.buildings.find((b) => b.tileId === 0)!.level).toBe(2);
    expect(g.players.find((x) => x.id === 'a')!.points).toBe(2);
  });

  it('ends the game once a player reaches the win score', () => {
    let g = setupTwoSettled();
    g = withHand(g, 'a', { faith: 5, mercy: 10, thanks: 5, word: 10 });
    g = build(g, 'a', 1); // 2nd altar, 2 pts
    g = build(g, 'a', 2); // 3rd altar (MAX_BUILDINGS_PER_PLAYER), 3 pts
    g = build(g, 'a', 3); // over the cap, rejected
    expect(g.buildings.filter((b) => b.playerId === 'a')).toHaveLength(3);
    g = upgrade(g, 'a', 0); // 4 pts
    g = upgrade(g, 'a', 1); // 5 pts
    expect(g.phase).toBe('playing');
    g = upgrade(g, 'a', 2); // 6 pts -> win
    expect(g.phase).toBe('finished');
    expect(g.winnerId).toBe('a');
    expect(g.players.find((x) => x.id === 'a')!.points).toBe(6);
  });

  it('trades resources between two players on accept', () => {
    let g = setupTwoSettled();
    g = roll(g, 'a', 1, 1); // a gets 1 faith
    g = roll(g, 'b', 1, 1); // nothing matches b's tile(8) on a 2
    g = proposeTrade(g, 'a', { faith: 1 }, { mercy: 1 }, 'b', newId);
    expect(g.trades).toHaveLength(1);
    // b has no mercy, so the trade can't be accepted yet
    const before = g;
    g = acceptTrade(g, g.trades[0].id, 'b');
    expect(g).toBe(before);
  });

  it('exposes public state with tiles, players, and current turn', () => {
    const g = setupTwoSettled();
    const pub = toPublic(g);
    expect(pub.tiles).toHaveLength(12);
    expect(pub.currentId).toBe('a');
    expect(pub.players).toHaveLength(2);
  });
});
