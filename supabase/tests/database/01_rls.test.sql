begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Tests own the weeks table for this transaction (rolled back), whatever real content exists.
truncate public.weeks cascade;

create or replace function pg_temp.mk_class(p_tz text default 'America/Denver') returns uuid language plpgsql as $$
declare t uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (t, t::text || '@teacher.test');
  insert into public.teachers (id, email) values (t, t::text || '@teacher.test');
  insert into public.classes (id, teacher_id, name, join_code, timezone)
    values (c, t, 'Test', upper(substr(md5(c::text), 1, 6)), p_tz);
  return c;
end $$;

create or replace function pg_temp.mk_student(p_class uuid, p_name text default 'kid') returns uuid language plpgsql as $$
declare s uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (s, s::text || '@students.tend.invalid');
  insert into public.students (id, class_id, display_name, pin_hash)
    values (s, p_class, p_name || substr(s::text, 1, 4), extensions.crypt('1234', extensions.gen_salt('bf', 4)));
  insert into public.pets (student_id, species, name) values (s, 'fox', 'Rusty');
  insert into public.streaks (student_id) values (s);
  return s;
end $$;

create or replace function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

select set_config('t.class_a', pg_temp.mk_class()::text, true);
select set_config('t.class_b', pg_temp.mk_class()::text, true);
select set_config('t.stu_a', pg_temp.mk_student(current_setting('t.class_a')::uuid)::text, true);
select set_config('t.stu_b', pg_temp.mk_student(current_setting('t.class_b')::uuid)::text, true);
select set_config('t.teacher_a', (select teacher_id::text from public.classes where id = current_setting('t.class_a')::uuid), true);
insert into public.reflections (student_id, date, body) values (current_setting('t.stu_a')::uuid, '2026-10-12', 'private thought');
insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status)
values (41, '2026-10-05', '2026-10-11', 'W41', 'Isaiah 50–57', 'u', 'kp', '{}', 'approved'),
       (42, '2026-10-12', '2026-10-18', 'W42', 'Isaiah 58–66', 'u', 'kp', '{}', 'draft');

-- Student A
select pg_temp.act_as(current_setting('t.stu_a')::uuid);
select is((select count(*)::int from public.students), 1, 'student sees only own student row');
select is((select count(*)::int from public.pets), 1, 'student sees only own pet');
select is((select count(*)::int from public.classes), 1, 'student sees only own class');
select throws_ok('select pin_hash from public.students', '42501', null, 'student cannot read pin_hash');
select throws_ok($$update public.streaks set current = 99$$, '42501', null, 'student cannot write streaks directly');
select is((select count(*)::int from public.weeks), 1, 'student sees approved weeks only');
select is((select count(*)::int from public.reflections), 1, 'student sees own reflection');
select throws_ok($$select public._login_check('AAAAAA','x','1234', now())$$, '42501', null,
  'student cannot execute service-only functions');
reset role;

-- Teacher A
select pg_temp.act_as(current_setting('t.teacher_a')::uuid);
select is((select count(*)::int from public.students), 1, 'teacher sees own class students only');
select is((select count(*)::int from public.reflections), 0, 'teacher cannot read reflections');
select is((select count(*)::int from public.weeks), 1, 'non-admin teacher sees approved weeks only');
reset role;

select * from finish();
rollback;
