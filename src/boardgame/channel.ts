import { supabase } from '../lib/supabase';
import type { Player, PublicPending } from './engine';

export type ToHost =
  | { t: 'hello'; p: Omit<Player, 'pos'> }
  | { t: 'roll'; id: string };

export interface PublicPlayer { id: string; name: string; species: string; color: number; pos: number; done: boolean }
export interface PublicState {
  boardId: string; title: string; totalSpaces: number;
  phase: 'lobby' | 'playing' | 'finished';
  players: PublicPlayer[]; currentId: string | null; pending: PublicPending | null; lastDie: number | null;
}

export interface Wire {
  sendToHost(m: ToHost): void;
  sendState(m: PublicState): void;
  close(): void;
}

/** One broadcast channel per class. No database tables: the host laptop holds the game. */
export function openWire(classId: string, onHost: (m: ToHost) => void, onState: (m: PublicState) => void, onReady: () => void): Wire {
  const ch = supabase.channel(`boardgame:${classId}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'host' }, (e) => onHost(e.payload as ToHost));
  ch.on('broadcast', { event: 'state' }, (e) => onState(e.payload as PublicState));
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') onReady(); });
  return {
    sendToHost: (m) => { void ch.send({ type: 'broadcast', event: 'host', payload: m }); },
    sendState: (m) => { void ch.send({ type: 'broadcast', event: 'state', payload: m }); },
    close: () => { void supabase.removeChannel(ch); },
  };
}
