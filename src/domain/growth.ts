export type Stage = 'hatchling' | 'little' | 'young' | 'grown' | 'legendary';

const STAGES: { stage: Stage; atDays: number }[] = [
  { stage: 'hatchling', atDays: 0 },
  { stage: 'little', atDays: 3 },
  { stage: 'young', atDays: 10 },
  { stage: 'grown', atDays: 25 },
  { stage: 'legendary', atDays: 50 },
];

export function stageFor(days: number): Stage {
  return [...STAGES].reverse().find((s) => days >= s.atDays)!.stage;
}

export function nextStage(days: number): { stage: Stage; atDays: number } | null {
  return STAGES.find((s) => s.atDays > days) ?? null;
}
