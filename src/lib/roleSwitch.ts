import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { isStudentEmail } from './useSession';

/**
 * Lets one phone hold a student session and a teacher session at the same time and flip between them
 * with no PIN. The latest tokens of each role are mirrored into localStorage whenever Supabase issues
 * them, so the toggle only exists on a device where BOTH roles have signed in at least once (a kid's
 * phone never has a teacher slot).
 */
export type Role = 'student' | 'teacher';
const key = (r: Role) => `tend-slot-${r}`;
const roleOf = (email?: string): Role => (isStudentEmail(email) ? 'student' : 'teacher');
let active: Role | null = null;

interface Slot { access_token: string; refresh_token: string }
const read = (r: Role): Slot | null => { try { const v = localStorage.getItem(key(r)); return v ? JSON.parse(v) as Slot : null; } catch { return null; } };
const write = (r: Role, s: Slot | null) => {
  try { if (s) localStorage.setItem(key(r), JSON.stringify(s)); else localStorage.removeItem(key(r)); } catch { /* private mode */ }
  window.dispatchEvent(new Event('tend-slots'));
};

/** Call once at startup. */
export function trackRoles() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      active = roleOf(session.user.email);
      write(active, { access_token: session.access_token, refresh_token: session.refresh_token });
    } else if (event === 'SIGNED_OUT' && active) {
      write(active, null); // explicit sign-out forgets that role on this device
      active = null;
    }
  });
}

export const otherRole = (r: Role): Role => (r === 'student' ? 'teacher' : 'student');
export const canSwitchTo = (r: Role) => read(r) !== null;

/** Swap the live session for the stored one of the other role. False if it expired or is missing. */
export async function switchTo(r: Role): Promise<boolean> {
  const slot = read(r);
  if (!slot) return false;
  const { error } = await supabase.auth.setSession(slot);
  if (error) { write(r, null); return false; }
  return true;
}

/** Re-renders when a role slot appears or disappears. */
export function useCanSwitchTo(r: Role): boolean {
  const [can, setCan] = useState(() => canSwitchTo(r));
  useEffect(() => {
    const f = () => setCan(canSwitchTo(r));
    window.addEventListener('tend-slots', f); window.addEventListener('storage', f); f();
    return () => { window.removeEventListener('tend-slots', f); window.removeEventListener('storage', f); };
  }, [r]);
  return can;
}
