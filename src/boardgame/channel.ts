import { supabase } from '../lib/supabase';
import type { Player, Hand, PublicState } from './engine';

export type ToHost =
  | { t: 'hello'; p: Omit<Player, 'resources' | 'points'> }
  | { t: 'roll'; id: string; die1: number; die2: number }
  | { t: 'settle'; id: string; tileId: number }
  | { t: 'build'; id: string; tileId: number }
  | { t: 'upgrade'; id: string; tileId: number }
  | { t: 'continueCard'; id: string }
  | { t: 'proposeTrade'; id: string; give: Partial<Hand>; want: Partial<Hand>; to: string | null }
  | { t: 'cancelTrade'; id: string; offerId: string }
  | { t: 'acceptTrade'; id: string; offerId: string };

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
