-- New functions are private unless explicitly granted.
-- PUBLIC's EXECUTE is a global default, so it must be revoked globally (a per-schema revoke can't remove it);
-- Supabase's anon/authenticated grants are per-schema, so those are revoked per-schema.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

create or replace function public.is_content_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select t.is_content_admin from public.teachers t where t.id = auth.uid()), false)
$$;

create or replace function public.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = auth.uid())
$$;

create or replace function public.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = p_student and c.teacher_id = auth.uid())
$$;

create or replace function public.my_class_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.class_id from public.students s where s.id = auth.uid()
$$;

grant execute on function public.is_content_admin(), public.teaches_class(uuid),
  public.teaches_student(uuid), public.my_class_id() to authenticated;

alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.pets enable row level security;
alter table public.streaks enable row level security;
alter table public.weeks enable row level security;
alter table public.daily_activity enable row level security;
alter table public.unlocks enable row level security;
alter table public.reflections enable row level security;
alter table public.game_scores enable row level security;

-- Nothing for anonymous users.
revoke all on all tables in schema public from anon;

-- Game state is written only through security-definer RPCs.
revoke insert, update, delete on public.teachers, public.classes, public.students, public.pets,
  public.streaks, public.daily_activity, public.unlocks, public.game_scores from authenticated;

-- Hide PIN data even from the row's owner.
revoke select on public.students from authenticated;
grant select (id, class_id, display_name, created_at, last_active_at) on public.students to authenticated;

create policy teachers_self on public.teachers for select to authenticated using (id = auth.uid());

create policy classes_read on public.classes for select to authenticated
  using (teacher_id = auth.uid() or id = public.my_class_id());

create policy students_read on public.students for select to authenticated
  using (id = auth.uid() or public.teaches_student(id));

create policy pets_read on public.pets for select to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id));

create policy streaks_read on public.streaks for select to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id));

create policy activity_read on public.daily_activity for select to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id));

create policy unlocks_read on public.unlocks for select to authenticated
  using (student_id = auth.uid());

-- Reflections: author only. Deliberately no teacher/admin policy.
create policy reflections_own on public.reflections for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy weeks_read on public.weeks for select to authenticated
  using (status = 'approved' or public.is_content_admin());
create policy weeks_admin_update on public.weeks for update to authenticated
  using (public.is_content_admin()) with check (public.is_content_admin());
revoke update on public.weeks from authenticated;
grant update (title, key_phrase, content, status, approved_at) on public.weeks to authenticated;
revoke insert, delete on public.weeks from authenticated;

-- game_scores: no direct reads; leaderboards come via RPC in Plan 4.
