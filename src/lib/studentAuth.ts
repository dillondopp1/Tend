import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { studentSession } from './functions';

export const joinClass = (code: string, name: string, pin: string) =>
  studentSession(supabase, SUPABASE_URL, SUPABASE_ANON_KEY, 'student-join', { code, name, pin });

export const signInStudent = (code: string, name: string, pin: string) =>
  studentSession(supabase, SUPABASE_URL, SUPABASE_ANON_KEY, 'student-login', { code, name, pin });
