import type { SupabaseClient } from '@supabase/supabase-js';

export type FnError =
  | 'bad_code' | 'name_taken' | 'bad_name' | 'bad_pin' | 'bad_login' | 'locked'
  | 'forbidden' | 'unauthorized' | 'server' | 'network';

export type FnResult<T> = { ok: true; data: T } | { ok: false; error: FnError };

export async function callFunction<T>(
  baseUrl: string, anonKey: string, name: string, body: unknown, accessToken?: string,
): Promise<FnResult<T>> {
  try {
    const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken ?? anonKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (json.error ?? 'server') as FnError };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function studentSession(
  client: SupabaseClient, baseUrl: string, anonKey: string,
  kind: 'student-join' | 'student-login' | 'teacher-login', body: Record<string, string>,
): Promise<FnResult<null>> {
  const r = await callFunction<{ tokenHash: string }>(baseUrl, anonKey, kind, body);
  if (!r.ok) return r;
  const { error } = await client.auth.verifyOtp({ token_hash: r.data.tokenHash, type: 'email' });
  if (error) return { ok: false, error: 'server' };
  return { ok: true, data: null };
}
