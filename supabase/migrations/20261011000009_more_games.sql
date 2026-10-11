-- Three more games: run (lane runner), launch (slingshot), slice (swipe to slice).
alter table public.game_scores drop constraint if exists game_scores_game_check;
alter table public.game_scores add constraint game_scores_game_check
  check (game in ('glide','dash','gather','stack','catch','run','launch','slice'));

create or replace function public._game_cap(p_game text) returns numeric
language sql immutable set search_path = '' as $$
  select case p_game when 'glide' then 2 when 'dash' then 40 when 'gather' then 500
                     when 'stack' then 3 when 'catch' then 10
                     when 'run' then 60 when 'launch' then 120 when 'slice' then 25 end
$$;

create or replace function public._record_game(p_student uuid, p_game text, p_score int, p_duration_ms int, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_class uuid; v_tz text; v_today date; v_week int; v_cap numeric; v_prev int; v_joy numeric;
begin
  select s.class_id, c.timezone into v_class, v_tz
  from public.students s join public.classes c on c.id = s.class_id where s.id = p_student;
  if v_class is null then raise exception 'not_a_student' using errcode = '42501'; end if;

  v_cap := public._game_cap(p_game);
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
