-- 1) Reflections belong to the PIN they were written under.
-- A PIN reset starts a fresh reflection history: rows written before the latest reset are no longer
-- readable (or editable) by any session, so a new PIN never opens up older private reflections.
-- (Hidden from clients: authenticated only has column-level SELECT on students.)
alter table public.students add column pin_reset_at timestamptz;

create or replace function public.my_pin_reset_at() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select s.pin_reset_at from public.students s where s.id = auth.uid()
$$;
revoke execute on function public.my_pin_reset_at() from public, anon;
grant execute on function public.my_pin_reset_at() to authenticated;

drop policy reflections_own on public.reflections;
create policy reflections_own on public.reflections for all to authenticated
  using (student_id = auth.uid()
         and created_at > coalesce((select public.my_pin_reset_at()), '-infinity'::timestamptz))
  with check (student_id = auth.uid());

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
        failed_attempts = 0, lockouts = 0, locked_until = null,
        pin_reset_at = now()
    where id = p_student;
  return jsonb_build_object('ok', true);
end $$;

-- 2) Teacher PINs: 6-12 digits, escalating lockout.
-- Every 5 misses locks the email: 1 hour, then 6 hours, then 24 hours for each later round.
-- A correct PIN clears the count. Never locks forever (the email link stays as a fallback).
-- Existing 4-digit PINs keep working; set a 6+ digit one with _set_teacher_pin (service role).
alter table public.teacher_pins add column lockouts int not null default 0;

create or replace function public._teacher_login_check(p_email text, p_pin text, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare tp public.teacher_pins;
begin
  select * into tp from public.teacher_pins where email = lower(trim(coalesce(p_email, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'bad_login'); end if;
  if tp.locked_until is not null and tp.locked_until > p_now then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  if coalesce(p_pin, '') ~ '^(\d{4}|\d{6,12})$' and tp.pin_hash = extensions.crypt(p_pin, tp.pin_hash) then
    update public.teacher_pins set failed_attempts = 0, lockouts = 0, locked_until = null where email = tp.email;
    return jsonb_build_object('ok', true, 'email', tp.email);
  end if;
  update public.teacher_pins
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        lockouts = case when failed_attempts + 1 >= 5 then lockouts + 1 else lockouts end,
        locked_until = case
          when failed_attempts + 1 < 5 then locked_until
          when lockouts = 0 then p_now + interval '1 hour'
          when lockouts = 1 then p_now + interval '6 hours'
          else p_now + interval '24 hours' end
    where email = tp.email;
  return jsonb_build_object('ok', false, 'error', 'bad_login');
end $$;

create or replace function public._set_teacher_pin(p_email text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'bad_email'); end if;
  if coalesce(p_pin, '') !~ '^\d{6,12}$' then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  insert into public.teacher_pins (email, pin_hash)
  values (v_email, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (email) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, lockouts = 0, locked_until = null;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public._set_teacher_pin(text, text) from public, anon, authenticated;
grant execute on function public._set_teacher_pin(text, text) to service_role;
