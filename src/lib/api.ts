import { supabase } from './supabase';
import type { SpeciesId } from '../domain/species';
import type { Stage } from '../domain/growth';

export type GameId = 'glide' | 'dash' | 'gather' | 'stack' | 'catch' | 'run' | 'launch' | 'slice';

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
export const recolorPet = (color: number) => rpc<null>('recolor_pet', { p_color: color });
export const completeSpark = (date: string) => rpc<SparkResult>('complete_spark', { p_date: date });
export const recordGame = (game: GameId, score: number, durationMs: number) =>
  rpc<GameResult>('record_game', { p_game: game, p_score: score, p_duration_ms: Math.round(durationMs) });

export type SparkCard =
  | { type: 'hook' | 'meaning' | 'try'; text: string }
  | { type: 'verse'; ref: string; text: string };

export interface DaySpark { day: number; section: string; manualAnchor: string; cards: SparkCard[]; reflectPrompt?: string }

export interface Week {
  id: number; start_date: string; end_date: string; title: string; scripture_block: string; manual_url: string;
  key_phrase: string; content: { keyPhraseRef?: string; sparks?: DaySpark[]; gameSparks?: string[]; phraseMeaning?: string };
}

export async function getWeek(id: number): Promise<Week | null> {
  const { data, error } = await supabase.from('weeks')
    .select('id,start_date,end_date,title,scripture_block,manual_url,key_phrase,content').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Week | null;
}

/** Day 1 = Monday … 7 = Sunday, for a date inside the week starting `start`. */
export function dayOfWeek(start: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000) + 1;
}

export function dateForDay(start: string, day: number): string {
  return new Date(Date.parse(start) + (day - 1) * 86_400_000).toISOString().slice(0, 10);
}

/** The spark for a day, falling back to the nearest earlier one so a week is never empty. */
export function sparkFor(week: Week, day: number): DaySpark | null {
  const s = (week.content.sparks ?? []).slice().sort((a, b) => a.day - b.day);
  return s.find((x) => x.day === day) ?? [...s].reverse().find((x) => x.day <= day) ?? s[0] ?? null;
}

export interface BoardRow { name: string; score: number; species: SpeciesId; color: number; me: boolean }
export interface Board { top: BoardRow[]; weekBest: number | null; personalBest: number | null }
export const leaderboard = (game: GameId) => rpc<Board>('leaderboard', { p_game: game });
