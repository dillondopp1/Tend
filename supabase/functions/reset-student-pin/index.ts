import { json, preflight, readBody } from '../_shared/http.ts';
import { admin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who, error } = await admin.auth.getUser(token);
  if (error || !who.user) return json({ error: 'unauthorized' }, 401);

  const { studentId, pin } = await readBody(req) as { studentId?: string; pin?: string };
  const { data, error: e2 } = await admin.rpc('_reset_pin', {
    p_teacher: who.user.id, p_student: studentId ?? null, p_pin: pin ?? '',
  });
  if (e2) return json({ error: 'server' }, 500);
  if (!data.ok) return json({ error: data.error }, data.error === 'forbidden' ? 403 : 400);
  return json({ ok: true });
});
