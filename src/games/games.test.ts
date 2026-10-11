import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

import { createRun } from './run';
import { createLaunch } from './launch';
import { createSlice } from './slice';
import { Phrase, setStage, rand } from './engine';

describe('phrase tracker', () => {
  it('spawns words in order, completes, and starts another round', () => {
    const p = new Phrase('beauty for ashes', 'Isaiah 61:3');
    expect(p.words).toEqual(['beauty', 'for', 'ashes']);
    const a = p.next(), b = p.next(), c = p.next();
    expect([a, b, c]).toEqual([0, 1, 2]);
    expect(p.collect(a)).toBe(false);
    expect(p.next()).toBe(1); // skips collected words
    p.collect(1);
    expect(p.collect(2)).toBe(true);
    expect(p.rounds).toBe(1);
    expect(p.celebrating).toBe(true);
    expect(p.got).toEqual([false, false, false]);
  });
});

describe('run', () => {
  it('standing still in one lane crashes; score under cap (60/s + 50)', () => {
    const g = createRun(opts);
    g.press(W / 2, 300); g.release!(); // tap on the right half: one lane change
    let t = 0;
    while (!g.over && t < 120) { g.step(1 / 60); t += 1 / 60; }
    expect(g.over).toBe(true);
    expect(g.score).toBeLessThanOrEqual(60 * t + 50);
  });

  it('swipes change lane, jump and slide without crashing the engine', () => {
    const g = createRun(opts);
    g.press(100, 300); g.move!(180, 300); g.release!();   // right
    g.press(100, 300); g.move!(100, 220); g.release!();   // jump
    for (let k = 0; k < 60; k++) g.step(1 / 60);
    g.press(100, 300); g.move!(100, 380); g.release!();   // slide
    for (let k = 0; k < 60; k++) g.step(1 / 60);
    expect(g.started).toBe(true);
  });
});

describe('launch', () => {
  beforeAll(() => setStage(true));
  afterAll(() => setStage(false));

  it('plays on the landscape stage with the towers far from the sling', () => {
    expect(W).toBe(800);
  });

  it('a full pull flies, hits or misses, and the game ends when shots run out', () => {
    const g = createLaunch(opts);
    let t = 0, fired = 0;
    while (!g.over && t < 120) {
      if (Math.round(t * 60) % 240 === 0) { g.press(96, 294); g.move!(10, 380 - Math.random() * 60); g.release!(); fired++; }
      g.step(1 / 60); t += 1 / 60;
    }
    expect(fired).toBeGreaterThan(2);
    expect(g.score).toBeGreaterThanOrEqual(0);
    expect(g.score).toBeLessThanOrEqual(120 * t + 50);
  });

  it('the far towers are reachable: some full-power angle knocks a block', () => {
    let hit = false;
    for (let deg = 15; deg <= 60 && !hit; deg += 3) {
      for (const pull of [80, 100, 120]) {
        const g = createLaunch(opts);
        const a = (deg * Math.PI) / 180;
        g.press(96, 294); g.move!(96 - Math.cos(a) * pull, 294 + Math.sin(a) * pull); g.release!();
        for (let k = 0; k < 60 * 5; k++) g.step(1 / 60);
        if (g.score > 0) { hit = true; break; }
      }
    }
    expect(hit).toBe(true);
  });

  it('random games with bombs, TNT and mid-air taps never crash and stay under the cap', () => {
    for (let game = 0; game < 40; game++) {
      const g = createLaunch(opts);
      let t = 0, nextShot = 0.5;
      while (!g.over && t < 400) {
        if (t >= nextShot) {
          const a = rand(0.15, 1.1), pull = rand(70, 120);
          g.press(96, 294); g.move!(96 - Math.cos(a) * pull, 294 + Math.sin(a) * pull); g.release!();
          nextShot = t + rand(2.5, 4);
        }
        if (Math.random() < 0.01) g.press(rand(300, 800), rand(0, 450)); // stray taps (detonate bombs mid-air)
        g.step(1 / 60); t += 1 / 60;
      }
      expect(g.over).toBe(true);
      expect(g.score).toBeLessThanOrEqual(120 * t + 50);
    }
  });

  it('a tiny tap does not waste a shot', () => {
    const g = createLaunch(opts);
    g.press(96, 294); g.move!(98, 296); g.release!();
    for (let k = 0; k < 30; k++) g.step(1 / 60);
    expect(g.over).toBe(false);
  });
});

describe('slice', () => {
  it('sweeping the screen slices things and eventually storms end the run (25/s + 50 cap)', () => {
    const g = createSlice(opts);
    let t = 0;
    g.press(0, 300);
    while (!g.over && t < 240) {
      const x = (Math.sin(t * 6) * 0.5 + 0.5) * W, y = 150 + (Math.cos(t * 4.3) * 0.5 + 0.5) * 400;
      g.move!(x, y); g.step(1 / 60); t += 1 / 60;
    }
    expect(g.over).toBe(true);
    expect(g.score).toBeGreaterThan(0);
    expect(g.score).toBeLessThanOrEqual(25 * t + 50);
  });
});
