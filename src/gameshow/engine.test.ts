import { describe, it, expect } from 'vitest';
import { newShow, addPlayer, advance, submitAnswer, castVote, removeAnswer, toPublic, everyoneDone, type Show } from './engine';
import { ROUNDS } from './rounds';

const secs = { write: 100, vote: 45 };
let n = 0;
const id = () => `a${++n}`;
const P = (i: string) => ({ id: i, name: i.toUpperCase(), species: 'fox', color: 0 });

function writing(players: string[]): Show {
  let s = newShow();
  players.forEach((p) => (s = addPlayer(s, P(p))));
  s = advance(s, 'start', 0, secs);
  return advance(s, 'closeWriting', 1000, secs);
}

describe('game show engine', () => {
  it('walks lobby -> intro -> writing with a timer', () => {
    const s = writing(['x', 'y', 'z']);
    expect(s.phase).toBe('writing');
    expect(s.endsAt).toBe(1000 + 100_000);
  });

  it('keeps one answer per player, trims and caps length, ignores answers outside writing', () => {
    let s = writing(['x', 'y', 'z']);
    s = submitAnswer(s, 'x', '  hello   there ', id);
    s = submitAnswer(s, 'x', 'second try', id);
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0].text).toBe('second try');
    s = submitAnswer(s, 'y', 'a'.repeat(500), id);
    expect(s.answers.find((a) => a.by === 'y')!.text).toHaveLength(140);
    expect(submitAnswer(s, 'nobody', 'hi', id)).toBe(s);
    expect(submitAnswer(newShow(), 'x', 'hi', id).answers).toHaveLength(0);
  });

  it('goes to voting with 3+ answers and hides authors until reveal', () => {
    let s = writing(['x', 'y', 'z']);
    for (const p of ['x', 'y', 'z']) s = submitAnswer(s, p, `answer from ${p}`, id);
    expect(everyoneDone(s)).toBe(true);
    s = advance(s, 'closeWriting', 2000, secs);
    expect(s.phase).toBe('voting');
    const pub = toPublic(s);
    expect(pub.answers.every((a) => a.by === undefined && a.votes === undefined)).toBe(true);
  });

  it('skips voting when fewer than 3 answers came in', () => {
    let s = writing(['x', 'y', 'z']);
    s = submitAnswer(s, 'x', 'only one', id);
    s = advance(s, 'closeWriting', 2000, secs);
    expect(s.phase).toBe('reveal');
  });

  it('blocks voting for your own answer and counts the rest at reveal', () => {
    let s = writing(['x', 'y', 'z']);
    for (const p of ['x', 'y', 'z']) s = submitAnswer(s, p, `answer from ${p}`, id);
    s = advance(s, 'closeWriting', 2000, secs);
    const own = s.answers.find((a) => a.by === 'x')!.aid;
    const y = s.answers.find((a) => a.by === 'y')!.aid;
    s = castVote(s, 'x', own);
    expect(s.votes.x).toBeUndefined();
    s = castVote(s, 'x', y);
    s = castVote(s, 'z', y);
    s = castVote(s, 'y', s.answers.find((a) => a.by === 'z')!.aid);
    expect(everyoneDone(s)).toBe(true);
    s = advance(s, 'closeVoting', 3000, secs);
    const pub = toPublic(s);
    expect(pub.phase).toBe('reveal');
    expect(pub.answers[0]).toMatchObject({ by: 'Y', votes: 2 });
  });

  it('removing an answer also drops votes for it', () => {
    let s = writing(['x', 'y', 'z']);
    for (const p of ['x', 'y', 'z']) s = submitAnswer(s, p, `answer from ${p}`, id);
    s = advance(s, 'closeWriting', 2000, secs);
    const y = s.answers.find((a) => a.by === 'y')!.aid;
    s = castVote(s, 'x', y);
    s = removeAnswer(s, y);
    expect(s.answers).toHaveLength(2);
    expect(s.votes.x).toBeUndefined();
  });

  it('runs all rounds then ends on the finale', () => {
    let s = writing(['x', 'y', 'z']);
    for (let r = 0; r < ROUNDS.length; r++) {
      expect(s.round).toBe(r);
      s = advance(s, 'closeWriting', 5000, secs); // no answers -> straight to reveal
      expect(s.phase).toBe('reveal');
      s = advance(s, 'next', 6000, secs);
      if (r < ROUNDS.length - 1) { expect(s.phase).toBe('intro'); s = advance(s, 'closeWriting', 7000, secs); }
    }
    expect(s.phase).toBe('finale');
  });

  it('a late joiner is added without losing anyone', () => {
    let s = writing(['x', 'y']);
    s = addPlayer(s, P('z'));
    s = addPlayer(s, { ...P('x'), name: 'Renamed' });
    expect(s.players).toHaveLength(3);
    expect(s.players[0].name).toBe('Renamed');
  });
});
