begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create or replace function pg_temp.mk_class() returns uuid language plpgsql as $$
declare t uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (t, t::text || '@teacher.test');
  insert into public.teachers (id, email) values (t, t::text || '@teacher.test');
  insert into public.classes (id, teacher_id, name, join_code, timezone)
    values (c, t, 'Test', upper(substr(md5(c::text), 1, 6)), 'America/Denver');
  return c;
end $$;

create or replace function pg_temp.mk_student(p_class uuid, p_name text) returns uuid language plpgsql as $$
declare s uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (s, s::text || '@students.tend.invalid');
  insert into public.students (id, class_id, display_name, pin_hash)
    values (s, p_class, p_name, extensions.crypt('1234', extensions.gen_salt('bf', 4)));
  insert into public.pets (student_id, species, name) values (s, 'otter', 'Ollie');
  insert into public.streaks (student_id) values (s);
  return s;
end $$;

create temp table ids as select pg_temp.mk_class() as c1, pg_temp.mk_class() as c2;
create temp table kids as
  select pg_temp.mk_student(c1, 'Ana') as a, pg_temp.mk_student(c1, 'Ben') as b, pg_temp.mk_student(c2, 'Cy') as c from ids;

select lives_ok($$ select public._record_game((select a from kids), 'glide', 10, 30000, '2026-10-13 18:00+00') $$, 'Ana plays');
select lives_ok($$ select public._record_game((select a from kids), 'glide', 4, 30000, '2026-10-13 18:05+00') $$, 'Ana plays worse');
select lives_ok($$ select public._record_game((select b from kids), 'glide', 20, 30000, '2026-10-13 18:10+00') $$, 'Ben plays');
select lives_ok($$ select public._record_game((select c from kids), 'glide', 50, 30000, '2026-10-13 18:10+00') $$, 'Cy (other class) plays');
select lives_ok($$ select public._record_game((select a from kids), 'glide', 30, 30000, '2026-10-06 18:00+00') $$, 'Ana last week');

select is(jsonb_array_length(public._leaderboard((select a from kids), 'glide', '2026-10-14 18:00+00')->'top'), 2,
  'only this class, one row per student');
select is(public._leaderboard((select a from kids), 'glide', '2026-10-14 18:00+00')->'top'->0->>'name', 'Ben', 'highest first');
select is((public._leaderboard((select a from kids), 'glide', '2026-10-14 18:00+00')->'top'->1->>'score')::int, 10,
  'best score this week, last week ignored');
select is((public._leaderboard((select a from kids), 'glide', '2026-10-14 18:00+00')->>'personalBest')::int, 30,
  'personal best spans all weeks');
select is((public._leaderboard((select a from kids), 'glide', '2026-10-14 18:00+00')->'top'->1->>'me')::boolean, true, 'marks me');
select is(has_function_privilege('anon', 'public.leaderboard(text)', 'execute'), false, 'anon cannot read leaderboards');
select is(has_function_privilege('authenticated', 'public._leaderboard(uuid,text,timestamptz)', 'execute'), false,
  'inner function is private');

select * from finish();
rollback;
