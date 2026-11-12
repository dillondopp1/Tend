begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create or replace function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ---------- Reflections written before a PIN reset stay private ----------
create temp table t as select gen_random_uuid() as teacher, gen_random_uuid() as cls, gen_random_uuid() as kid;
grant select on t to public;
insert into auth.users (id, email) select teacher, teacher::text || '@teacher.test' from t;
insert into public.teachers (id, email) select teacher, teacher::text || '@teacher.test' from t;
insert into public.classes (id, teacher_id, name, join_code) select cls, teacher, 'C', upper(substr(md5(cls::text), 1, 6)) from t;
insert into auth.users (id, email) select kid, kid::text || '@students.tend.invalid' from t;
insert into public.students (id, class_id, display_name, pin_hash)
  select kid, cls, 'Ana', extensions.crypt('1234', extensions.gen_salt('bf', 4)) from t;
insert into public.reflections (student_id, date, body, created_at)
  select kid, '2026-10-12', 'before reset', now() - interval '1 day' from t;

select pg_temp.act_as((select kid from t));
select is((select count(*)::int from public.reflections), 1, 'no reset yet: student sees own reflection');
reset role;

select is(public._reset_pin((select teacher from t), (select kid from t), '2468')->>'ok', 'true', 'teacher resets the PIN');
select ok((select pin_reset_at is not null from public.students where id = (select kid from t)), 'reset time recorded');

select pg_temp.act_as((select kid from t));
select is((select count(*)::int from public.reflections), 0, 'after a reset, older reflections are not readable');
select lives_ok($$insert into public.reflections (date, body, created_at) values ('2026-10-13', 'after reset', now() + interval '1 second')$$,
  'student keeps writing reflections');
select is((select count(*)::int from public.reflections), 1, 'new reflections are readable');
select is((select body from public.reflections), 'after reset', 'only the new one');
update public.reflections set body = 'changed';
delete from public.reflections where body = 'before reset';
select throws_ok('select pin_reset_at from public.students', '42501', null, 'student cannot read pin_reset_at');
reset role;

select is((select body from public.reflections where student_id = (select kid from t) and date = '2026-10-12'), 'before reset',
  'older reflection cannot be edited or deleted after a reset');

select pg_temp.act_as((select teacher from t));
select is((select count(*)::int from public.reflections), 0, 'teacher still reads no reflections');
reset role;

select is(position('reflect' in public._class_roster((select teacher from t), (select cls from t), now())::text), 0,
  'roster never mentions reflections');
select is(position('pin_reset' in public._class_roster((select teacher from t), (select cls from t), now())::text), 0,
  'roster never shows reset times');
select is(has_function_privilege('anon', 'public.my_pin_reset_at()', 'execute'), false, 'anon cannot call my_pin_reset_at');

-- ---------- Teacher PIN: 6-12 digits, escalating lockout ----------
insert into public.teacher_pins (email, pin_hash) values ('long@test.dev', extensions.crypt('24681357', extensions.gen_salt('bf', 4)));
insert into public.teacher_pins (email, pin_hash) values ('old@test.dev', extensions.crypt('1234', extensions.gen_salt('bf', 4)));

select is(public._teacher_login_check('long@test.dev', '24681357', '2026-11-01 12:00+00')->>'ok', 'true', '8-digit PIN works');
select is(public._teacher_login_check('old@test.dev', '1234', '2026-11-01 12:00+00')->>'ok', 'true', 'existing 4-digit PIN still works');
select is(public._teacher_login_check('long@test.dev', '2468135', '2026-11-01 12:00+00')->>'error', 'bad_login', 'wrong PIN');
select is(public._teacher_login_check('long@test.dev', '1234567890123', '2026-11-01 12:00+00')->>'error', 'bad_login', '13 digits rejected');

-- Round 1: the two misses above + 3 more -> 1 hour (the 4th call below is already locked).
select public._teacher_login_check('long@test.dev', '00000000', '2026-11-01 12:00+00') from generate_series(1, 4);
select is(public._teacher_login_check('long@test.dev', '24681357', '2026-11-01 12:59+00')->>'error', 'locked', 'first lockout');
select is(public._teacher_login_check('long@test.dev', '00000000', '2026-11-01 13:01+00')->>'error', 'bad_login', 'first lockout lasts an hour');
-- Round 2: 5 misses -> 6 hours.
select public._teacher_login_check('long@test.dev', '00000000', '2026-11-01 13:01+00') from generate_series(1, 4);
select is(public._teacher_login_check('long@test.dev', '24681357', '2026-11-01 18:59+00')->>'error', 'locked', 'second lockout lasts 6 hours');
select is(public._teacher_login_check('long@test.dev', '00000000', '2026-11-01 19:02+00')->>'error', 'bad_login', 'second lockout ends');
-- Round 3: 5 misses -> 24 hours.
select public._teacher_login_check('long@test.dev', '00000000', '2026-11-01 19:02+00') from generate_series(1, 4);
select is(public._teacher_login_check('long@test.dev', '24681357', '2026-11-02 19:01+00')->>'error', 'locked', 'third lockout lasts 24 hours');
select is(public._teacher_login_check('long@test.dev', '00000000', '2026-11-02 19:03+00')->>'error', 'bad_login', 'third lockout ends');
-- Round 4: still 24 hours.
select public._teacher_login_check('long@test.dev', '00000000', '2026-11-02 19:03+00') from generate_series(1, 4);
select is(public._teacher_login_check('long@test.dev', '24681357', '2026-11-03 19:02+00')->>'error', 'locked', 'later lockouts stay 24 hours');
select is(public._teacher_login_check('long@test.dev', '24681357', '2026-11-03 19:04+00')->>'ok', 'true', 'right PIN after the lockout');
select is((select lockouts from public.teacher_pins where email = 'long@test.dev'), 0, 'success clears the lockout count');

select is(public._set_teacher_pin('New@Test.dev', '1234')->>'error', 'bad_pin', 'new PINs need 6+ digits');
select is(public._set_teacher_pin('new@test.dev', '1234567890123')->>'error', 'bad_pin', 'new PINs are at most 12 digits');
select is(public._set_teacher_pin(' New@Test.dev ', '97531086')->>'ok', 'true', 'set an 8-digit PIN');
select is(public._teacher_login_check('new@test.dev', '97531086', '2026-11-01 12:00+00')->>'ok', 'true', 'the new PIN signs in');
select is(has_function_privilege('anon', 'public._set_teacher_pin(text,text)', 'execute'), false, 'anon cannot set PINs');
select is(has_function_privilege('authenticated', 'public._set_teacher_pin(text,text)', 'execute'), false, 'users cannot set PINs');

select * from finish();
rollback;
