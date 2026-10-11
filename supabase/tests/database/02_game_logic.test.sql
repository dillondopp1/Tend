begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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
  insert into public.pets (student_id, species, name, stats_at) values (s, 'fox', 'Rusty', '2026-10-12 06:00+00');
  insert into public.streaks (student_id) values (s);
  return s;
end $$;

-- Tests own the weeks table for this transaction (rolled back), whatever real content exists.
truncate public.weeks cascade;
insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status)
values (41, '2026-10-05', '2026-10-11', 'W41', 'b', 'u', 'kp', '{}', 'approved'),
       (42, '2026-10-12', '2026-10-18', 'W42', 'b', 'u', 'kp', '{}', 'draft'),
       (52, '2026-12-21', '2026-12-27', 'W52', 'b', 'u', 'kp', '{}', 'approved');

-- Time and weeks
select is(public._local_date('America/Denver', '2026-10-13 05:30+00'), '2026-10-12'::date, 'timezone: local date');
select is(public._week_for_date('2026-10-14'), 41, 'unapproved week falls back to latest approved');
update public.weeks set status = 'approved' where id = 42;
select is(public._week_for_date('2026-10-14'), 42, 'approved week containing the date wins');
select is(public._week_for_date('2026-12-30'), 52, 'after Christmas lesson keeps showing 52');
select is(public._week_for_date('2026-01-01'), null::int, 'no week before any content');

-- Decay and growth
select is(round(public._decayed(100, '2026-10-12 00:00+00', '2026-10-13 12:00+00'), 3), 50::numeric, 'decay 36h = 50');
select is(public._decayed(100, '2026-10-12 00:00+00', '2026-10-20 00:00+00'), 0::numeric, 'decay floors at 0');
select is(public._growth_stage(0), 'hatchling', 'stage 0');
select is(public._growth_stage(3), 'little', 'stage 3');
select is(public._growth_stage(10), 'young', 'stage 10');
select is(public._growth_stage(25), 'grown', 'stage 25');
select is(public._growth_stage(50), 'legendary', 'stage 50');

-- Spark: first time today (Mon Oct 12, noon MDT = 18:00 UTC)
select set_config('t.c', pg_temp.mk_class()::text, true);
select set_config('t.s', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
select set_config('t.r', public._complete_spark(current_setting('t.s')::uuid, '2026-10-12', '2026-10-12 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'first spark: streak 1');
select is((current_setting('t.r')::jsonb->>'firstTime')::boolean, true, 'first spark: firstTime');
select is((select fed from public.pets where student_id = current_setting('t.s')::uuid), 100::numeric, 'spark sets fed 100');
select is((select lifetime_days from public.pets where student_id = current_setting('t.s')::uuid), 1, 'lifetime 1');

-- Second spark same day: no double count
select set_config('t.r', public._complete_spark(current_setting('t.s')::uuid, '2026-10-12', '2026-10-12 19:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'firstTime')::boolean, false, 'second spark same day: not first');
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'second spark same day: streak unchanged');
select is((select lifetime_days from public.pets where student_id = current_setting('t.s')::uuid), 1, 'second spark same day: lifetime unchanged');

-- Next day extends
select set_config('t.r', public._complete_spark(current_setting('t.s')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 2, 'next day: streak 2');

-- Out of range dates
select throws_ok(format($$select public._complete_spark(%L, '2026-10-15', '2026-10-13 18:00+00')$$, current_setting('t.s')), '22023', null, 'future date refused');
select throws_ok(format($$select public._complete_spark(%L, '2026-10-11', '2026-10-13 18:00+00')$$, current_setting('t.s')), '22023', null, 'date before Monday refused');
select throws_ok(format($$select public._complete_spark(%L, '2026-10-13', '2026-10-13 05:30+00')$$, current_setting('t.s')), '22023', null, 'UTC date that is still yesterday locally is future');

-- Catch-up: new student does Wednesday then catches up Monday
select set_config('t.s2', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
select public._complete_spark(current_setting('t.s2')::uuid, '2026-10-14', '2026-10-14 18:00+00');
select set_config('t.r', public._complete_spark(current_setting('t.s2')::uuid, '2026-10-12', '2026-10-14 18:05+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'catch-up does not extend streak');
select is((select lifetime_days from public.pets where student_id = current_setting('t.s2')::uuid), 2, 'catch-up adds lifetime day');
select is((select was_catch_up from public.daily_activity where student_id = current_setting('t.s2')::uuid and date = '2026-10-12'), true, 'catch-up flagged');

-- Streak break with no shields keeps best, never negative
select set_config('t.s3', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 5, best = 5, shields = 0, last_tended_date = '2026-10-10' where student_id = current_setting('t.s3')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s3')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streakReset')::boolean, true, 'break reported');
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'break: new streak starts at 1');
select is((current_setting('t.r')::jsonb->>'best')::int, 5, 'break: best kept');

-- Shield covers a one-day gap
select set_config('t.s4', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 7, best = 7, shields = 1, last_tended_date = '2026-10-11' where student_id = current_setting('t.s4')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s4')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'shieldsUsed')::int, 1, 'shield used');
select is((current_setting('t.r')::jsonb->>'streak')::int, 8, 'shield kept streak going');
select is((current_setting('t.r')::jsonb->>'shields')::int, 0, 'shield spent');

-- Gap bigger than shields: break, shields kept
select set_config('t.s5', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 9, best = 9, shields = 1, last_tended_date = '2026-10-10' where student_id = current_setting('t.s5')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s5')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'gap > shields breaks');
select is((current_setting('t.r')::jsonb->>'shields')::int, 1, 'shields not spent on a lost cause');

-- Zero streak never spends shields
select set_config('t.s6', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 0, best = 3, shields = 2, last_tended_date = '2026-10-11' where student_id = current_setting('t.s6')::uuid;
select is((public._sync_streak(current_setting('t.s6')::uuid, '2026-10-13')->>'shieldsUsed')::int, 0, 'zero streak keeps shields');

-- Day 7 earns a shield and the scarf; cap at 3
select set_config('t.s7', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 6, best = 6, shields = 0, last_tended_date = '2026-10-12' where student_id = current_setting('t.s7')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s7')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'shields')::int, 1, 'day 7 earns shield');
select is(current_setting('t.r')::jsonb->>'milestoneReward', 'acc_scarf', 'day 7 milestone reward');
select ok(exists(select 1 from public.unlocks where student_id = current_setting('t.s7')::uuid and item_id = 'acc_scarf'), 'reward unlocked');
update public.streaks set current = 27, shields = 3, last_tended_date = '2026-10-13' where student_id = current_setting('t.s7')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s7')::uuid, '2026-10-14', '2026-10-14 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'shields')::int, 3, 'shields cap at 3');

-- Games
select set_config('t.g', public._record_game(current_setting('t.s')::uuid, 'glide', 20, 30000, '2026-10-13 20:00+00')::text, true);
select is((current_setting('t.g')::jsonb->>'isNewBest')::boolean, true, 'first score is a best');
select set_config('t.g', public._record_game(current_setting('t.s')::uuid, 'glide', 10, 30000, '2026-10-13 20:05+00')::text, true);
select is((current_setting('t.g')::jsonb->>'personalBest')::int, 20, 'personal best kept');
select is((current_setting('t.g')::jsonb->>'isNewBest')::boolean, false, 'lower score not best');
select throws_ok(format($$select public._record_game(%L, 'glide', 500, 10000, now())$$, current_setting('t.s')), '22023', null, 'implausible score refused');
select throws_ok(format($$select public._record_game(%L, 'tetris', 5, 10000, now())$$, current_setting('t.s')), '22023', null, 'unknown game refused');
select is((select games_played from public.daily_activity where student_id = current_setting('t.s')::uuid and date = '2026-10-13'), 2, 'games counted on the day');

-- Joy +25 capped
update public.pets set joy = 90, fed = 90, stats_at = '2026-10-13 21:00+00' where student_id = current_setting('t.s')::uuid;
select public._record_game(current_setting('t.s')::uuid, 'dash', 100, 20000, '2026-10-13 21:00+00');
select is((select joy from public.pets where student_id = current_setting('t.s')::uuid), 100::numeric, 'joy capped at 100');

-- sync_pet shape
select set_config('t.p', public._sync_pet(current_setting('t.s')::uuid, '2026-10-14 18:00+00')::text, true);
select is(current_setting('t.p')::jsonb->>'today', '2026-10-14', 'sync today');
select is(current_setting('t.p')::jsonb->>'monday', '2026-10-12', 'sync monday');
select is((current_setting('t.p')::jsonb->'streak'->>'current')::int, 2, 'sync streak');
select is(jsonb_array_length(current_setting('t.p')::jsonb->'sparksDone'), 2, 'sync sparks done this week');
select is(current_setting('t.p')::jsonb->'pet'->>'stage', 'hatchling', 'sync stage');

select * from finish();
rollback;
