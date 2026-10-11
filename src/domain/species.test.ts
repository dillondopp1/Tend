import { describe, it, expect } from 'vitest';
import { SPECIES } from './species';

describe('SPECIES', () => {
  it('has exactly the 15 spec species with unique ids', () => {
    const ids = SPECIES.map((s) => s.id);
    expect(ids).toEqual([
      'fox', 'bunny', 'panda', 'cat', 'puppy', 'owl', 'penguin', 'axolotl',
      'red_panda', 'otter', 'frog', 'hedgehog', 'lamb', 'turtle', 'koala',
    ]);
    expect(new Set(ids).size).toBe(15);
  });
});
