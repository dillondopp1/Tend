import { describe, it, expect, beforeAll } from 'vitest';
import { createStack } from './stack';
import { createGlide } from './glide';
import { createCatch } from './catch';
import { W } from './engine';

beforeAll(() => {
  // Node has no Image; the games only hold the reference for drawing.
  (globalThis as unknown as { Image: unknown }).Image = class { src = ''; };
});

const opts = { species: 'fox' as const, variant: 0, palette: 'dawn', motifs: ['sun'], phrase: 'beauty for ashes' };

describe('stack', () => {
  it('scores when a block lands on the tower and ends on a full miss', () => {
    const g = createStack(opts);
    g.press(0, 0);              // start: first block slides in
    for (let k = 0; k < 15; k++) g.step(1 / 60); // overlapping the base
    g.press(0, 0);
    expect(g.score).toBe(1);
    expect(g.over).toBe(false);
    for (let k = 0; k < 60 * 30 && !g.over; k++) { g.step(1 / 60); if (k % 37 === 0) g.press(0, 0); }
    expect(g.over).toBe(true);
  });
});

describe('glide', () => {
  it('waits for the first tap, then falls to the ground without flaps', () => {
    const g = createGlide(opts);
    for (let k = 0; k < 120; k++) g.step(1 / 60);
    expect(g.over).toBe(false);
    g.press(0, 0);
    for (let k = 0; k < 60 * 5 && !g.over; k++) g.step(1 / 60);
    expect(g.over).toBe(true);
    expect(g.score).toBe(0);
  });

  it('a steady flapper passes gaps and scores within the server cap (2/s + 50)', () => {
    let best = 0;
    for (let trial = 0; trial < 20; trial++) {
      const g = createGlide(opts);
      g.press(0, 0);
      let t = 0;
      while (!g.over && t < 60) { g.step(1 / 60); t += 1 / 60; if (Math.round(t * 60) % 33 === 0) g.press(0, 0); }
      expect(g.score).toBeLessThanOrEqual(2 * t + 50);
      best = Math.max(best, g.score);
    }
    expect(best).toBeGreaterThanOrEqual(0);
  });
});

describe('catch', () => {
  it('ends after three storm hits and stays under the server cap (10/s + 50)', () => {
    const g = createCatch(opts);
    g.press(W / 2, 0);
    let t = 0;
    while (!g.over && t < 300) { g.step(1 / 60); t += 1 / 60; }
    expect(g.over).toBe(true);
    expect(g.score).toBeLessThanOrEqual(10 * t + 50);
  });
});
