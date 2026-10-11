import { json, preflight, readBody } from '../_shared/http.ts';
import { admin, tokenHashFor } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const { code, name, pin } = await readBody(req) as { code?: string; name?: string; pin?: string };

  const { data, error } = await admin.rpc('_login_check', {
    p_code: code ?? '', p_name: name ?? '', p_pin: pin ?? '', p_now: new Date().toISOString(),
  });
  if (error) return json({ error: 'server' }, 500);
  if (!data.ok) return json({ error: data.error }, data.error === 'locked' ? 423 : 401);

  const { data: u, error: e2 } = await admin.auth.admin.getUserById(data.studentId);
  if (e2 || !u.user?.email) return json({ error: 'server' }, 500);
  try {
    return json({ tokenHash: await tokenHashFor(u.user.email) });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
