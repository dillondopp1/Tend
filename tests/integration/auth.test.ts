import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { callFunction, studentSession } from '../../src/lib/functions';

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const fresh = () => createClient(URL, ANON, { auth: { persistSession: false } });

let code = '';
let teacherId = '';
let teacherToken = '';
const name = `Kid${Math.floor(Math.random() * 1e6)}`;

beforeAll(async () => {
  const email = `t${Date.now()}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: 'teacher-pass-123', email_confirm: true });
  if (error) throw error;
  teacherId = u.user!.id;
  await admin.from('teachers').insert({ id: teacherId, email });
  code = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'A').padEnd(5, 'A');
  const { error: ce } = await admin.from('classes').insert({ teacher_id: teacherId, name: 'Int Test', join_code: code });
  if (ce) throw ce;
  const t = fresh();
  const { data: s } = await t.auth.signInWithPassword({ email, password: 'teacher-pass-123' });
  teacherToken = s.session!.access_token;
});

// This runs against the real cloud project, so remove every account the test made.
afterAll(async () => {
  const { data: classes } = await admin.from('classes').select('id').eq('teacher_id', teacherId);
  const ids = (classes ?? []).map((c) => c.id);
  const { data: students } = ids.length
    ? await admin.from('students').select('id').in('class_id', ids)
    : { data: [] };
  for (const s of students ?? []) await admin.auth.admin.deleteUser(s.id);
  if (teacherId) await admin.auth.admin.deleteUser(teacherId);
});

describe('student sign-in', () => {
  it('joins, gets a real session, and can call sync_pet', async () => {
    const client = fresh();
    const r = await studentSession(client, URL, ANON, 'student-join', { code, name, pin: '2468' });
    expect(r.ok).toBe(true);
    const { data, error } = await client.rpc('sync_pet');
    expect(error).toBeNull();
    expect(data.pet).toBeNull();
  });

  it('rejects a duplicate name in the same class', async () => {
    const r = await callFunction(URL, ANON, 'student-join', { code, name: name.toLowerCase(), pin: '1111' });
    expect(r).toEqual({ ok: false, error: 'name_taken' });
  });

  it('logs back in with the right PIN and refuses the wrong one', async () => {
    const ok = await studentSession(fresh(), URL, ANON, 'student-login', { code, name, pin: '2468' });
    expect(ok.ok).toBe(true);
    const bad = await callFunction(URL, ANON, 'student-login', { code, name, pin: '0000' });
    expect(bad).toEqual({ ok: false, error: 'bad_login' });
  });

  it('teacher resets the PIN; a student token cannot', async () => {
    const { data: stu } = await admin.from('students').select('id').eq('display_name', name).single();
    const r = await callFunction(URL, ANON, 'reset-student-pin', { studentId: stu!.id, pin: '1357' }, teacherToken);
    expect(r.ok).toBe(true);
    const ok = await studentSession(fresh(), URL, ANON, 'student-login', { code, name, pin: '1357' });
    expect(ok.ok).toBe(true);
    const anonTry = await callFunction(URL, ANON, 'reset-student-pin', { studentId: stu!.id, pin: '1111' });
    expect(anonTry.ok).toBe(false);
  });
});
