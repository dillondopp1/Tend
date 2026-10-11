export const DECAY_PER_HOUR = 100 / 72;

export function decayed(value: number, statsAt: Date, now: Date): number {
  const hours = Math.max(0, (now.getTime() - statsAt.getTime()) / 3_600_000);
  return Math.max(0, Math.min(100, value - hours * DECAY_PER_HOUR));
}

export type Mood = 'thriving' | 'content' | 'sleepy' | 'misses-you';

export function moodFor(fed: number, joy: number): Mood {
  const low = Math.min(fed, joy);
  if (low >= 70) return 'thriving';
  if (low >= 40) return 'content';
  if (low >= 15) return 'sleepy';
  return 'misses-you';
}
