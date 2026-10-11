-- Tables, views and sequences added by later migrations are closed by default:
-- nothing for anon, read-only for authenticated until a migration grants more.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from authenticated;

-- Escalating lockout: every 5 misses locks 15 minutes; the third lockout lasts until a teacher resets the PIN.
-- (Hidden from clients: authenticated only has column-level SELECT on the columns granted in the RLS migration.)
alter table public.students add column lockouts int not null default 0;

create or replace function public._login_check(p_code text, p_name text, p_pin text, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare st public.students;
begin
  select s.* into st from public.students s join public.classes c on c.id = s.class_id
  where c.join_code = upper(trim(coalesce(p_code, ''))) and lower(s.display_name) = lower(trim(coalesce(p_name, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'bad_login'); end if;
  if st.locked_until is not null and st.locked_until > p_now then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  if coalesce(p_pin, '') ~ '^\d{4}$' and st.pin_hash = extensions.crypt(p_pin, st.pin_hash) then
    update public.students set failed_attempts = 0, lockouts = 0, locked_until = null where id = st.id;
    return jsonb_build_object('ok', true, 'studentId', st.id);
  end if;
  update public.students
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        lockouts = case when failed_attempts + 1 >= 5 then lockouts + 1 else lockouts end,
        locked_until = case
          when failed_attempts + 1 < 5 then locked_until
          when lockouts + 1 >= 3 then 'infinity'::timestamptz
          else p_now + interval '15 minutes' end
    where id = st.id;
  return jsonb_build_object('ok', false, 'error', 'bad_login');
end $$;

create or replace function public._reset_pin(p_teacher uuid, p_student uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.students s join public.classes c on c.id = s.class_id
                 where s.id = p_student and c.teacher_id = p_teacher) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  update public.students
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
        failed_attempts = 0, lockouts = 0, locked_until = null
    where id = p_student;
  return jsonb_build_object('ok', true);
end $$;
