import { createClient } from 'npm:@supabase/supabase-js@2';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const STUDENT_EMAIL_DOMAIN = 'students.tend.invalid';

/** Mints a one-time token the client exchanges for a session via verifyOtp. */
export async function tokenHashFor(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) throw error ?? new Error('no token');
  return data.properties.hashed_token;
}
