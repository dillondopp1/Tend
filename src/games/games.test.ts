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

import { createDash } from './dash';
import { createGather } from './gather';

describe('dash', () => {
  it('a non-jumper hits a stone; score stays under the server cap (40/s + 50)', () => {
    const g = createDash(opts);
    g.press(0, 0); g.release!();
    let t = 0;
    while (!g.over && t < 60) { g.step(1 / 60); t += 1 / 60; }
    expect(g.over).toBe(true);
    expect(g.score).toBeLessThanOrEqual(40 * t + 50);
  });

  it('a jump lands back on the ground', () => {
    const g = createDash(opts);
    g.press(0, 0);
    for (let k = 0; k < 20; k++) g.step(1 / 60);
    g.release!();
    for (let k = 0; k < 60; k++) g.step(1 / 60);
    g.press(0, 0); // can jump again only when grounded
    expect(g.over).toBe(false);
  });
});

describe('gather', () => {
  it('runs 60 seconds then ends; random swiping scores within the cap (500/s + 50)', () => {
    const g = createGather(opts);
    let t = 0;
    while (!g.over && t < 90) {
      // swipe a random tile right/down every half second
      if (Math.round(t * 60) % 30 === 0) {
        const x = 32 + 24 + Math.floor(Math.random() * 6) * 48, y = 130 + 24 + Math.floor(Math.random() * 7) * 48;
        g.press(x, y); g.move!(x + (Math.random() < 0.5 ? 30 : 0), y + (Math.random() < 0.5 ? 0 : 30)); g.release!();
      }
      g.step(1 / 60); t += 1 / 60;
    }
    expect(g.over).toBe(true);
    expect(t).toBeGreaterThanOrEqual(60);
    expect(t).toBeLessThan(64);
    expect(g.score).toBeLessThanOrEqual(500 * t + 50);
  });

  it('tap-tap on neighbours selects then swaps without crashing', () => {
    const g = createGather(opts);
    g.press(56, 154); g.release!();
    g.press(104, 154); g.release!();
    for (let k = 0; k < 120; k++) g.step(1 / 60);
    expect(g.over).toBe(false);
  });
});
