begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create or replace function pg_temp.act_as(p_uid uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'email', p_email)::text, true);
  execute 'set local role authenticated';
end $$;

-- Teacher creates a class
select set_config('t.t', gen_random_uuid()::text, true);
insert into auth.users (id, email) values (current_setting('t.t')::uuid, 'teach@example.com');
select pg_temp.act_as(current_setting('t.t')::uuid, 'teach@example.com');
select is((public.ensure_teacher()).email, 'teach@example.com', 'ensure_teacher creates row');
select is((public.ensure_teacher()).email, 'teach@example.com', 'ensure_teacher is idempotent');
select set_config('t.class', (public.create_class('Sunday 16s')).id::text, true);
select throws_ok($$select public.create_class('Bad', 'Mars/Olympus')$$, '22023', null, 'bad timezone refused');
reset role;
select set_config('t.code', (select join_code from public.classes where id = current_setting('t.class')::uuid), true);
select matches(current_setting('t.code'), '^[A-HJ-NP-Z2-9]{6}$', 'join code uses unambiguous alphabet');

-- Join check
select is(public._join_check(lower(current_setting('t.code')), ' Sam ')->>'ok', 'true', 'join_check ok, code case-insensitive');
select is(public._join_check('ZZZZZZ', 'Sam')->>'error', 'bad_code', 'join_check bad code');
select is(public._join_check(current_setting('t.code'), '   ')->>'error', 'bad_name', 'join_check blank name');

-- Register
select set_config('t.s', gen_random_uuid()::text, true);
insert into auth.users (id, email) values (current_setting('t.s')::uuid, current_setting('t.s') || '@students.tend.invalid');
select is(public._register_student(current_setting('t.s')::uuid, current_setting('t.class')::uuid, ' Sam ', '12a4')->>'error', 'bad_pin', 'register rejects non-digit pin');
select is(public._register_student(current_setting('t.s')::uuid, current_setting('t.class')::uuid, ' Sam ', '4321')->>'ok', 'true', 'register ok');
select is((select display_name from public.students where id = current_setting('t.s')::uuid), 'Sam', 'name trimmed');
select is(public._join_check(current_setting('t.code'), 'sam ')->>'error', 'name_taken', 'join_check rejects case/space variant');

-- Login
select is(public._login_check(current_setting('t.code'), 'SAM', '4321', now())->>'studentId', current_setting('t.s'), 'login ok case-insensitive');
select is(public._login_check(current_setting('t.code'), 'Nobody', '4321', now())->>'error', 'bad_login', 'unknown name gives generic error');
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 18:00+00') from generate_series(1, 4);
select is((select failed_attempts from public.students where id = current_setting('t.s')::uuid), 4, 'failed attempts persist');
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-12 18:01+00')->>'ok', 'true', '4 misses then correct works');
select is((select failed_attempts from public.students where id = current_setting('t.s')::uuid), 0, 'success resets counter');
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 18:02+00') from generate_series(1, 5);
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-12 18:03+00')->>'error', 'locked', 'locked after 5 misses even with right pin');
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-12 18:18+00')->>'ok', 'true', 'unlocked after 15 minutes');

-- Students can't become teachers
select pg_temp.act_as(current_setting('t.s')::uuid, current_setting('t.s') || '@students.tend.invalid');
select throws_ok('select public.ensure_teacher()', '42501', null, 'student cannot become teacher');
reset role;

-- Escalation: the third lockout needs a teacher reset (stops endless 15-minute guessing cycles)
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 18:30+00') from generate_series(1, 5);
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 18:50+00') from generate_series(1, 5);
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 19:10+00') from generate_series(1, 5);
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-14 19:10+00')->>'error', 'locked', 'third lockout lasts until a teacher resets');

-- PIN reset
select is(public._reset_pin(current_setting('t.t')::uuid, current_setting('t.s')::uuid, '9999')->>'ok', 'true', 'teacher resets pin');
select is(public._login_check(current_setting('t.code'), 'Sam', '9999', '2026-10-14 19:11+00')->>'ok', 'true', 'teacher reset clears the lock and new pin works');
select is(public._reset_pin(gen_random_uuid(), current_setting('t.s')::uuid, '1111')->>'error', 'forbidden', 'other teacher cannot reset');

-- Regenerate code
select pg_temp.act_as(current_setting('t.t')::uuid, 'teach@example.com');
select isnt(public.regenerate_join_code(current_setting('t.class')::uuid), current_setting('t.code'), 'regenerated code differs');
reset role;

select * from finish();
rollback;
