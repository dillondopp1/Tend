import { supabase } from './supabase';
import type { SpeciesId } from '../domain/species';
import type { Stage } from '../domain/growth';

export type GameId = 'glide' | 'dash' | 'gather' | 'stack' | 'catch';

export interface PetState {
  species: SpeciesId; colorVariant: number; name: string;
  fed: number; joy: number; statsAt: string;
  lifetimeDays: number; stage: Stage; equipped: Record<string, string>;
}

export interface AppState {
  today: string; monday: string; weekId: number | null; awayHours: number | null;
  pet: PetState | null;
  streak: { current: number; best: number; shields: number; lastTendedDate: string | null } | null;
  events: { shieldsUsed: number; streakReset: boolean } | null;
  sparksDone: string[]; unlocks: string[];
}

export interface SparkResult {
  firstTime: boolean; streakExtended: boolean; streak: number; best: number; shields: number;
  shieldsUsed: number; streakReset: boolean; milestoneReward: string | null;
  lifetimeDays: number; stage: Stage;
}

export interface GameResult { personalBest: number; isNewBest: boolean; joy: number }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const syncPet = () => rpc<AppState>('sync_pet');
export const adoptPet = (species: SpeciesId, color: number, name: string) =>
  rpc<AppState>('adopt_pet', { p_species: species, p_color: color, p_name: name });
export const completeSpark = (date: string) => rpc<SparkResult>('complete_spark', { p_date: date });
export const recordGame = (game: GameId, score: number, durationMs: number) =>
  rpc<GameResult>('record_game', { p_game: game, p_score: score, p_duration_ms: Math.round(durationMs) });
