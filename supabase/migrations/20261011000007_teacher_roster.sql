-- Teacher dashboard (spec §11): roster + class at a glance. Reflections are never included.
create or replace function public._class_roster(p_teacher uuid, p_class uuid, p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_tz text; v_today date; v_monday date; v_rows jsonb;
begin
  select c.timezone into v_tz from public.classes c where c.id = p_class and c.teacher_id = p_teacher;
  if v_tz is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_today := public._local_date(v_tz, p_now);
  v_monday := v_today - (extract(isodow from v_today)::int - 1);

  select coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'id', s.id, 'name', s.display_name, 'joinedAt', s.created_at, 'lastActiveAt', s.last_active_at,
      'locked', s.locked_until is not null and s.locked_until > p_now,
      'pet', case when p.student_id is null then null else jsonb_build_object(
        'species', p.species, 'color', p.color_variant, 'name', p.name, 'stage', public._growth_stage(p.lifetime_days),
        'fed', round(public._decayed(p.fed, p.stats_at, p_now)), 'joy', round(public._decayed(p.joy, p.stats_at, p_now))) end,
      'streak', coalesce(st.current, 0), 'best', coalesce(st.best, 0),
      'sparkToday', exists (select 1 from public.daily_activity a where a.student_id = s.id and a.date = v_today and a.spark_done_at is not null),
      'sparksWeek', (select count(*) from public.daily_activity a where a.student_id = s.id and a.date between v_monday and v_today and a.spark_done_at is not null),
      'gamesWeek', (select coalesce(sum(a.games_played), 0) from public.daily_activity a where a.student_id = s.id and a.date between v_monday and v_today)
    ) as r
    from public.students s
    left join public.pets p on p.student_id = s.id
    left join public.streaks st on st.student_id = s.id
    where s.class_id = p_class
  ) x;

  return jsonb_build_object('today', v_today, 'daysSoFar', v_today - v_monday + 1, 'students', v_rows);
end $$;

create or replace function public.class_roster(p_class uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public._class_roster(auth.uid(), p_class, now())
$$;

revoke execute on function public._class_roster(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.class_roster(uuid) from public, anon;
grant execute on function public.class_roster(uuid) to authenticated;
