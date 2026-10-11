begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table t as select gen_random_uuid() as teacher, gen_random_uuid() as other, gen_random_uuid() as cls, gen_random_uuid() as kid;
insert into auth.users (id, email) select teacher, teacher::text || '@teacher.test' from t;
insert into auth.users (id, email) select other, other::text || '@teacher.test' from t;
insert into public.teachers (id, email) select teacher, teacher::text || '@teacher.test' from t;
insert into public.teachers (id, email) select other, other::text || '@teacher.test' from t;
insert into public.classes (id, teacher_id, name, join_code) select cls, teacher, 'C', upper(substr(md5(cls::text), 1, 6)) from t;
insert into auth.users (id, email) select kid, kid::text || '@students.tend.invalid' from t;
insert into public.students (id, class_id, display_name, pin_hash) select kid, cls, 'Ana', 'x' from t;
insert into public.pets (student_id, species, name, stats_at) select kid, 'lamb', 'Dude', '2026-10-13 18:00+00' from t;
insert into public.streaks (student_id, current, best) select kid, 4, 9 from t;
insert into public.daily_activity (student_id, date, spark_done_at, games_played)
  select kid, d::date, case when d::date <> '2026-10-13' then now() end, 2 from t, generate_series('2026-10-12'::date, '2026-10-14'::date, '1 day') d;
insert into public.reflections (student_id, date, body) select kid, '2026-10-13', 'secret thoughts' from t;

select is((public._class_roster((select teacher from t), (select cls from t), '2026-10-14 18:00+00')->'students'->0->>'sparksWeek')::int, 2,
  'sparks done this week');
select is((public._class_roster((select teacher from t), (select cls from t), '2026-10-14 18:00+00')->'students'->0->>'gamesWeek')::int, 6,
  'games this week');
select is((public._class_roster((select teacher from t), (select cls from t), '2026-10-14 18:00+00')->'students'->0->>'sparkToday')::boolean, true,
  'spark today');
select is((public._class_roster((select teacher from t), (select cls from t), '2026-10-14 18:00+00')->'students'->0->>'streak')::int, 4, 'streak');
select is((public._class_roster((select teacher from t), (select cls from t), '2026-10-14 18:00+00')->'students'->0->'pet'->>'name'), 'Dude', 'pet');
select is(position('secret' in public._class_roster((select teacher from t), (select cls from t), '2026-10-14 18:00+00')::text), 0,
  'reflections never appear');
select throws_ok($$ select public._class_roster((select other from t), (select cls from t), now()) $$, '42501', 'forbidden',
  'another teacher cannot read the roster');
select is(has_function_privilege('anon', 'public.class_roster(uuid)', 'execute'), false, 'anon cannot call');

select * from finish();
rollback;
