import { describe, it, expect } from 'vitest';
import { newGame, addPlayer, start, judgeId, play, closePlays, pick, next, removePlayer, toPublic, type Game } from './engine';
import { HAND_SIZE, WIN_GREENS, deckFor } from './board';

const p = (id: string) => ({ id, name: id, species: 'fox', color: 0 });
// Deterministic "random" so shuffles are repeatable.
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function threePlayers(): Game {
  let g = newGame();
  for (const id of ['a', 'b', 'c']) g = addPlayer(g, p(id));
  return start(g, seeded());
}
const hand = (g: Game, id: string) => g.players.find((x) => x.id === id)!.hand;

describe('Harvest Picks engine', () => {
  it('needs 3 players to start, then deals hands and flips a green', () => {
    let g = newGame();
    g = addPlayer(g, p('a'));
    g = addPlayer(g, p('b'));
    expect(start(g, seeded()).phase).toBe('lobby');
    g = start(addPlayer(g, p('c')), seeded());
    expect(g.phase).toBe('playing');
    expect(g.green).not.toBeNull();
    for (const pl of g.players) expect(pl.hand).toHaveLength(HAND_SIZE);
    expect(judgeId(g)).toBe('a');
  });

  it('the judge cannot play, and nobody plays twice or plays a card they do not hold', () => {
    let g = threePlayers();
    const before = g;
    expect(play(g, 'a', hand(g, 'a')[0])).toBe(before); // judge
    expect(play(g, 'b', hand(g, 'c')[0])).toBe(before); // not b's card
    g = play(g, 'b', hand(g, 'b')[0]);
    expect(play(g, 'b', hand(g, 'b')[0])).toBe(g); // already played
  });

  it('moves to judging once everyone but the judge has played, and hides who played what', () => {
    let g = threePlayers();
    g = play(g, 'b', hand(g, 'b')[0], seeded());
    expect(g.phase).toBe('playing');
    g = play(g, 'c', hand(g, 'c')[0], seeded());
    expect(g.phase).toBe('judging');
    expect(toPublic(g).plays.every((x) => x.by === null)).toBe(true);
  });

  it('the host can close plays early when someone is slow', () => {
    let g = threePlayers();
    g = play(g, 'b', hand(g, 'b')[0]);
    g = closePlays(g, seeded());
    expect(g.phase).toBe('judging');
    expect(g.plays).toHaveLength(1);
  });

  it('only the judge can pick; the winner keeps the green and names show on the reveal', () => {
    let g = threePlayers();
    const bCard = hand(g, 'b')[0];
    g = play(g, 'b', bCard);
    g = play(g, 'c', hand(g, 'c')[0]);
    expect(pick(g, 'b', bCard)).toBe(g); // b is not judging
    g = pick(g, 'a', bCard);
    expect(g.phase).toBe('reveal');
    expect(g.players.find((x) => x.id === 'b')!.greens).toHaveLength(1);
    expect(toPublic(g).plays.every((x) => x.by !== null)).toBe(true);
  });

  it('next round refills hands and passes the judge along', () => {
    let g = threePlayers();
    const bCard = hand(g, 'b')[0];
    g = play(g, 'b', bCard);
    g = play(g, 'c', hand(g, 'c')[0]);
    g = pick(g, 'a', bCard);
    g = next(g, seeded());
    expect(g.phase).toBe('playing');
    expect(judgeId(g)).toBe('b');
    for (const pl of g.players) expect(pl.hand).toHaveLength(HAND_SIZE);
  });

  it('ends when someone collects enough greens', () => {
    let g = threePlayers();
    for (let r = 0; r < 40 && g.phase !== 'finished'; r++) {
      const jid = judgeId(g)!;
      for (const o of g.players.filter((x) => x.id !== jid)) g = play(g, o.id, hand(g, o.id)[0], seeded(r + 2));
      const cPlay = g.plays.find((x) => x.by === 'c') ?? g.plays[0];
      g = pick(g, jid, cPlay.card);
      if (g.phase === 'reveal') g = next(g, seeded(r + 3));
    }
    expect(g.phase).toBe('finished');
    expect(g.players.find((x) => x.id === g.winnerId)!.greens).toHaveLength(WIN_GREENS);
  });

  it('never runs out of red cards over a long game with 12 players', () => {
    let g = newGame();
    for (let i = 0; i < 12; i++) g = addPlayer(g, p(`p${i}`));
    g = start(g, seeded());
    for (let r = 0; r < 30 && g.phase !== 'finished'; r++) {
      const jid = judgeId(g)!;
      for (const o of g.players.filter((x) => x.id !== jid)) g = play(g, o.id, hand(g, o.id)[0], seeded(r + 5));
      g = pick(g, jid, g.plays[r % g.plays.length].card);
      if (g.phase === 'reveal') g = next(g, seeded(r + 7));
      if (g.phase === 'playing') for (const pl of g.players) expect(pl.hand.length).toBe(HAND_SIZE);
    }
    expect(deckFor().reds.length).toBeGreaterThan(12 * HAND_SIZE);
  });

  it('a late joiner gets a hand; removing the judge passes judging on', () => {
    let g = threePlayers();
    g = addPlayer(g, p('d'));
    expect(hand(g, 'd')).toHaveLength(HAND_SIZE);
    g = removePlayer(g, 'a');
    expect(judgeId(g)).toBe('b');
    expect(g.players).toHaveLength(3);
  });
});
