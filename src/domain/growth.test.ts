import { describe, it, expect } from 'vitest';
import { stageFor, nextStage } from './growth';

describe('growth', () => {
  it('maps lifetime days to stages', () => {
    expect([0, 2, 3, 9, 10, 24, 25, 49, 50].map(stageFor)).toEqual(
      ['hatchling', 'hatchling', 'little', 'little', 'young', 'young', 'grown', 'grown', 'legendary']);
  });
  it('reports the next stage', () => {
    expect(nextStage(4)).toEqual({ stage: 'young', atDays: 10 });
    expect(nextStage(50)).toBeNull();
  });
});
