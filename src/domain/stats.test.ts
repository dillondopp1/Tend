import { describe, it, expect } from 'vitest';
import { decayed, moodFor } from './stats';

const t0 = new Date('2026-10-12T00:00:00Z');
const at = (h: number) => new Date(t0.getTime() + h * 3_600_000);

describe('decayed', () => {
  it('drops 100 to 50 in 36 hours', () => expect(decayed(100, t0, at(36))).toBeCloseTo(50));
  it('floors at 0', () => expect(decayed(100, t0, at(100))).toBe(0));
  it('never rises if the clock is behind', () => expect(decayed(80, t0, at(-5))).toBe(80));
});

describe('moodFor', () => {
  it('uses the lower stat', () => expect(moodFor(95, 45)).toBe('content'));
  it('thresholds', () => {
    expect(moodFor(70, 70)).toBe('thriving');
    expect(moodFor(40, 99)).toBe('content');
    expect(moodFor(15, 99)).toBe('sleepy');
    expect(moodFor(14.9, 99)).toBe('misses-you');
  });
});
