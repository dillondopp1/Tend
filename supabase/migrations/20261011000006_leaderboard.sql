-- Weekly class leaderboard (spec §10.2): each student's best score this week, top 10.
-- Game scores only; streaks never appear here.
create or replace function public._leaderboard(p_student uuid, p_game text, p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_class uuid; v_tz text; v_week int; v_top jsonb; v_mine int; v_best int;
begin
  select s.class_id, c.timezone into v_class, v_tz
  from public.students s join public.classes c on c.id = s.class_id where s.id = p_student;
  if v_class is null then raise exception 'not_a_student' using errcode = '42501'; end if;
  v_week := public._week_for_date(public._local_date(v_tz, p_now));

  select coalesce(jsonb_agg(jsonb_build_object('name', t.display_name, 'score', t.score, 'species', t.species,
                                               'color', t.color_variant, 'me', t.student_id = p_student) order by t.score desc, t.first_at), '[]'::jsonb)
  into v_top
  from (
    select g.student_id, st.display_name, p.species, p.color_variant, max(g.score) as score, min(g.created_at) as first_at
    from public.game_scores g
    join public.students st on st.id = g.student_id
    left join public.pets p on p.student_id = g.student_id
    where g.class_id = v_class and g.game = p_game and g.week_id is not distinct from v_week
    group by g.student_id, st.display_name, p.species, p.color_variant
    order by max(g.score) desc, min(g.created_at)
    limit 10
  ) t;

  select max(score) into v_mine from public.game_scores
    where student_id = p_student and game = p_game and week_id is not distinct from v_week;
  select max(score) into v_best from public.game_scores where student_id = p_student and game = p_game;

  return jsonb_build_object('top', v_top, 'weekBest', v_mine, 'personalBest', v_best);
end $$;

create or replace function public.leaderboard(p_game text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public._leaderboard(auth.uid(), p_game, now())
$$;

revoke execute on function public._leaderboard(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.leaderboard(text) from public, anon;
grant execute on function public.leaderboard(text) to authenticated;
