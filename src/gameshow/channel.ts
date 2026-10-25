import { supabase } from '../lib/supabase';
import type { Player, PublicState } from './engine';

export type ToHost =
  | { t: 'hello'; p: Player }
  | { t: 'answer'; id: string; text: string }
  | { t: 'vote'; id: string; aid: string };

/** Host -> phones. `left` is seconds remaining so phone clocks don't have to agree with the laptop's. */
export type StateMsg = PublicState & { left: number | null };

export interface Wire {
  sendToHost(m: ToHost): void;
  sendState(m: StateMsg): void;
  close(): void;
}

/** One broadcast channel per class. No database tables: the host laptop holds the show. */
export function openWire(classId: string, onHost: (m: ToHost) => void, onState: (m: StateMsg) => void, onReady: () => void): Wire {
  const ch = supabase.channel(`gameshow:${classId}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'host' }, (e) => onHost(e.payload as ToHost));
  ch.on('broadcast', { event: 'state' }, (e) => onState(e.payload as StateMsg));
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') onReady(); });
  return {
    sendToHost: (m) => { void ch.send({ type: 'broadcast', event: 'host', payload: m }); },
    sendState: (m) => { void ch.send({ type: 'broadcast', event: 'state', payload: m }); },
    close: () => { void supabase.removeChannel(ch); },
  };
}
