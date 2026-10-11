create or replace function public._local_date(p_tz text, p_now timestamptz) returns date
language sql stable set search_path = '' as $$
  select (p_now at time zone p_tz)::date
$$;

create or replace function public._week_for_date(p_date date) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select w.id from public.weeks w where w.status = 'approved' and p_date between w.start_date and w.end_date),
    (select w.id from public.weeks w where w.status = 'approved' and w.start_date <= p_date order by w.start_date desc limit 1))
$$;

create or replace function public._decayed(p_value numeric, p_at timestamptz, p_now timestamptz) returns numeric
language sql immutable set search_path = '' as $$
  select greatest(0::numeric, least(100::numeric,
    p_value - (extract(epoch from greatest(p_now - p_at, interval '0')) / 3600.0) * (100.0 / 72.0)))
$$;

create or replace function public._growth_stage(p_days int) returns text
language sql immutable set search_path = '' as $$
  select case when p_days >= 50 then 'legendary' when p_days >= 25 then 'grown'
              when p_days >= 10 then 'young' when p_days >= 3 then 'little' else 'hatchling' end
$$;

create or replace function public._milestone_reward(p_streak int) returns text
language sql immutable set search_path = '' as $$
  select case p_streak
    when 3 then 'acc_beanie' when 7 then 'acc_scarf' when 14 then 'bg_sunrise' when 21 then 'acc_glasses'
    when 30 then 'color_gold' when 50 then 'acc_crown' when 75 then 'bg_stars' when 100 then 'acc_flower_crown'
  end
$$;

create or replace function public._sync_streak(p_student uuid, p_today date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.streaks; gap int;
begin
  select * into s from public.streaks where student_id = p_student for update;
  if not found or s.last_tended_date is null or s.current = 0 then
    return jsonb_build_object('shieldsUsed', 0, 'streakReset', false);
  end if;
  gap := p_today - s.last_tended_date - 1;
  if gap <= 0 then
    return jsonb_build_object('shieldsUsed', 0, 'streakReset', false);
  end if;
  if gap <= s.shields then
    update public.streaks set shields = shields - gap, last_tended_date = p_today - 1 where student_id = p_student;
    return jsonb_build_object('shieldsUsed', gap, 'streakReset', false);
  end if;
  update public.streaks set current = 0 where student_id = p_student;
  return jsonb_build_object('shieldsUsed', 0, 'streakReset', true);
end $$;

create or replace function public._student_tz(p_student uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.timezone from public.students s join public.classes c on c.id = s.class_id where s.id = p_student
$$;

create or replace function public._complete_spark(p_student uuid, p_date date, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := public._student_tz(p_student);
  v_today date; v_monday date; v_week int; v_already boolean; v_sync jsonb;
  s public.streaks; v_extended boolean := false; v_reward text; v_lifetime int;
begin
  if v_tz is null then raise exception 'not_a_student' using errcode = '42501'; end if;
  v_today := public._local_date(v_tz, p_now);
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_date > v_today or p_date < v_monday then
    raise exception 'spark_date_out_of_range' using errcode = '22023';
  end if;
  v_week := public._week_for_date(p_date);
  if v_week is null then raise exception 'no_content' using errcode = '22023'; end if;

  v_sync := public._sync_streak(p_student, v_today);

  select exists (select 1 from public.daily_activity
                 where student_id = p_student and date = p_date and spark_done_at is not null) into v_already;
  if not v_already then
    insert into public.daily_activity (student_id, date, week_id, spark_done_at, was_catch_up)
    values (p_student, p_date, v_week, p_now, p_date < v_today)
    on conflict (student_id, date) do update
      set spark_done_at = excluded.spark_done_at, week_id = excluded.week_id, was_catch_up = excluded.was_catch_up;
    update public.pets set lifetime_days = lifetime_days + 1 where student_id = p_student;
  end if;

  update public.pets set joy = public._decayed(joy, stats_at, p_now), fed = 100, stats_at = p_now
  where student_id = p_student;

  select * into s from public.streaks where student_id = p_student for update;
  if p_date = v_today and s.last_tended_date is distinct from v_today then
    update public.streaks
      set current = current + 1,
          best = greatest(best, current + 1),
          last_tended_date = v_today,
          shields = case when (current + 1) % 7 = 0 then least(shields + 1, 3) else shields end
      where student_id = p_student
      returning * into s;
    v_extended := true;
    v_reward := public._milestone_reward(s.current);
    if v_reward is not null then
      insert into public.unlocks (student_id, item_id, unlocked_at) values (p_student, v_reward, p_now)
      on conflict do nothing;
    end if;
  end if;

  select lifetime_days into v_lifetime from public.pets where student_id = p_student;
  return jsonb_build_object(
    'firstTime', not v_already, 'streakExtended', v_extended,
    'streak', s.current, 'best', s.best, 'shields', s.shields,
    'shieldsUsed', (v_sync->>'shieldsUsed')::int, 'streakReset', (v_sync->>'streakReset')::boolean,
    'milestoneReward', v_reward, 'lifetimeDays', v_lifetime, 'stage', public._growth_stage(v_lifetime));
end $$;

create or replace function public._record_game(p_student uuid, p_game text, p_score int, p_duration_ms int, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_class uuid; v_tz text; v_today date; v_week int; v_cap numeric; v_prev int; v_joy numeric;
begin
  select s.class_id, c.timezone into v_class, v_tz
  from public.students s join public.classes c on c.id = s.class_id where s.id = p_student;
  if v_class is null then raise exception 'not_a_student' using errcode = '42501'; end if;

  v_cap := case p_game when 'glide' then 2 when 'dash' then 40 when 'gather' then 500
                       when 'stack' then 3 when 'catch' then 10 end;
  if v_cap is null then raise exception 'bad_game' using errcode = '22023'; end if;
  if p_duration_ms is null or p_duration_ms < 1000 or p_duration_ms > 3600000
     or p_score is null or p_score < 0 or p_score > v_cap * p_duration_ms / 1000.0 + 50 then
    raise exception 'implausible_score' using errcode = '22023';
  end if;

  v_today := public._local_date(v_tz, p_now);
  v_week := public._week_for_date(v_today);
  select max(score) into v_prev from public.game_scores where student_id = p_student and game = p_game;

  insert into public.game_scores (student_id, class_id, game, week_id, score, duration_ms, created_at)
  values (p_student, v_class, p_game, v_week, p_score, p_duration_ms, p_now);

  update public.pets
    set fed = public._decayed(fed, stats_at, p_now),
        joy = least(100, public._decayed(joy, stats_at, p_now) + 25),
        stats_at = p_now
    where student_id = p_student
    returning joy into v_joy;

  insert into public.daily_activity (student_id, date, week_id, games_played)
  values (p_student, v_today, v_week, 1)
  on conflict (student_id, date) do update set games_played = public.daily_activity.games_played + 1;

  return jsonb_build_object('personalBest', greatest(coalesce(v_prev, 0), p_score),
                            'isNewBest', v_prev is null or p_score > v_prev, 'joy', v_joy);
end $$;

create or replace function public._sync_pet(p_student uuid, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := public._student_tz(p_student);
  v_today date; v_monday date; v_prev timestamptz; v_sync jsonb; p public.pets; s public.streaks;
  v_done jsonb; v_unlocks jsonb;
begin
  if v_tz is null then raise exception 'not_a_student' using errcode = '42501'; end if;
  v_today := public._local_date(v_tz, p_now);
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  select last_active_at into v_prev from public.students where id = p_student;
  update public.students set last_active_at = p_now where id = p_student;

  select * into p from public.pets where student_id = p_student;
  if not found then
    return jsonb_build_object('today', v_today, 'monday', v_monday, 'weekId', public._week_for_date(v_today),
                              'awayHours', null, 'pet', null, 'streak', null, 'events', null,
                              'sparksDone', '[]'::jsonb, 'unlocks', '[]'::jsonb);
  end if;

  v_sync := public._sync_streak(p_student, v_today);
  select * into s from public.streaks where student_id = p_student;
  select coalesce(jsonb_agg(date order by date), '[]'::jsonb) into v_done
    from public.daily_activity
    where student_id = p_student and date between v_monday and v_today and spark_done_at is not null;
  select coalesce(jsonb_agg(item_id order by unlocked_at), '[]'::jsonb) into v_unlocks
    from public.unlocks where student_id = p_student;

  return jsonb_build_object(
    'today', v_today, 'monday', v_monday, 'weekId', public._week_for_date(v_today),
    'awayHours', case when v_prev is null then null else round(extract(epoch from p_now - v_prev) / 3600.0, 1) end,
    'pet', jsonb_build_object(
      'species', p.species, 'colorVariant', p.color_variant, 'name', p.name,
      'fed', round(public._decayed(p.fed, p.stats_at, p_now), 1),
      'joy', round(public._decayed(p.joy, p.stats_at, p_now), 1),
      'statsAt', p_now, 'lifetimeDays', p.lifetime_days,
      'stage', public._growth_stage(p.lifetime_days), 'equipped', p.equipped),
    'streak', jsonb_build_object('current', s.current, 'best', s.best, 'shields', s.shields,
                                 'lastTendedDate', s.last_tended_date),
    'events', v_sync, 'sparksDone', v_done, 'unlocks', v_unlocks);
end $$;

-- Client-facing RPCs: always use the caller's identity and the real clock.
create or replace function public.sync_pet() returns jsonb
language sql security definer set search_path = '' as $$
  select public._sync_pet(auth.uid(), now())
$$;

create or replace function public.complete_spark(p_date date) returns jsonb
language sql security definer set search_path = '' as $$
  select public._complete_spark(auth.uid(), p_date, now())
$$;

create or replace function public.record_game(p_game text, p_score int, p_duration_ms int) returns jsonb
language sql security definer set search_path = '' as $$
  select public._record_game(auth.uid(), p_game, p_score, p_duration_ms, now())
$$;

create or replace function public.adopt_pet(p_species text, p_color int, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.students where id = auth.uid()) then
    raise exception 'not_a_student' using errcode = '42501';
  end if;
  if exists (select 1 from public.pets where student_id = auth.uid()) then
    raise exception 'already_adopted' using errcode = '23505';
  end if;
  if p_color is null or p_color not between 0 and 2 then
    raise exception 'bad_color' using errcode = '22023';
  end if;
  insert into public.pets (student_id, species, color_variant, name)
  values (auth.uid(), p_species, p_color, trim(p_name));
  insert into public.streaks (student_id) values (auth.uid()) on conflict do nothing;
  return public._sync_pet(auth.uid(), now());
end $$;

grant execute on function public.sync_pet(), public.complete_spark(date),
  public.record_game(text, int, int), public.adopt_pet(text, int, text) to authenticated;
