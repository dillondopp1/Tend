import { json, preflight, readBody } from '../_shared/http.ts';
import { admin, tokenHashFor } from '../_shared/admin.ts';

// Teacher sign-in with email + 4-digit PIN. Creates the auth user on first use (the PIN row,
// set by hand, is the authorisation), then hands back a one-time token like the student flow.
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const { email, pin } = await readBody(req) as { email?: string; pin?: string };

  const { data, error } = await admin.rpc('_teacher_login_check', {
    p_email: email ?? '', p_pin: pin ?? '', p_now: new Date().toISOString(),
  });
  if (error) return json({ error: 'server' }, 500);
  if (!data.ok) return json({ error: data.error }, data.error === 'locked' ? 423 : 401);

  const { error: ce } = await admin.auth.admin.createUser({ email: data.email, email_confirm: true });
  if (ce && !/already|exists|registered/i.test(ce.message)) return json({ error: 'server' }, 500);
  try {
    return json({ tokenHash: await tokenHashFor(data.email) });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
