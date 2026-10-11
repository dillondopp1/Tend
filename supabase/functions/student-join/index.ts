import { json, preflight, readBody } from '../_shared/http.ts';
import { admin, STUDENT_EMAIL_DOMAIN, tokenHashFor } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const { code, name, pin } = await readBody(req) as { code?: string; name?: string; pin?: string };
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return json({ error: 'bad_pin' }, 400);

  const { data: check, error: e1 } = await admin.rpc('_join_check', { p_code: code ?? '', p_name: name ?? '' });
  if (e1) return json({ error: 'server' }, 500);
  if (!check.ok) return json({ error: check.error }, check.error === 'name_taken' ? 409 : 400);

  const email = `${crypto.randomUUID()}@${STUDENT_EMAIL_DOMAIN}`;
  const { data: created, error: e2 } = await admin.auth.admin.createUser({
    email, password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: true,
    user_metadata: { role: 'student' },
  });
  if (e2 || !created.user) return json({ error: 'server' }, 500);

  const { data: reg, error: e3 } = await admin.rpc('_register_student', {
    p_id: created.user.id, p_class: check.classId, p_name: name, p_pin: pin,
  });
  if (e3 || !reg.ok) {
    await admin.auth.admin.deleteUser(created.user.id);
    if (e3) return json({ error: 'server' }, 500);
    return json({ error: reg.error }, reg.error === 'name_taken' ? 409 : 400);
  }

  try {
    return json({ tokenHash: await tokenHashFor(email) });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
