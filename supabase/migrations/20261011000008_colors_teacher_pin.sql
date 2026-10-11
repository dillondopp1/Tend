-- 1) Eight colour choices per animal (was 3), and a way to recolour an existing pet.
create or replace function public.adopt_pet(p_species text, p_color int, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.students where id = auth.uid()) then
    raise exception 'not_a_student' using errcode = '42501';
  end if;
  if exists (select 1 from public.pets where student_id = auth.uid()) then
    raise exception 'already_adopted' using errcode = '23505';
  end if;
  if p_color is null or p_color not between 0 and 7 then
    raise exception 'bad_color' using errcode = '22023';
  end if;
  insert into public.pets (student_id, species, color_variant, name)
  values (auth.uid(), p_species, p_color, trim(p_name));
  insert into public.streaks (student_id) values (auth.uid()) on conflict do nothing;
  return public._sync_pet(auth.uid(), now());
end $$;

create or replace function public.recolor_pet(p_color int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_color is null or p_color not between 0 and 7 then
    raise exception 'bad_color' using errcode = '22023';
  end if;
  update public.pets set color_variant = p_color where student_id = auth.uid();
  if not found then raise exception 'no_pet' using errcode = '22023'; end if;
end $$;

revoke execute on function public.recolor_pet(int) from public, anon;
grant execute on function public.recolor_pet(int) to authenticated;

-- 2) Teacher sign-in with email + 4-digit PIN (magic links still work as a fallback).
-- Keyed by email so a PIN can be set before the teacher's first sign-in. Service role only.
-- PIN hashes are set by hand (never in this public repo).
create table public.teacher_pins (
  email text primary key check (email = lower(email)),
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz
);
alter table public.teacher_pins enable row level security;
revoke all on public.teacher_pins from anon, authenticated;

-- 5 wrong PINs lock the email for an hour. Never locks forever: a teacher has no one to reset them.
create or replace function public._teacher_login_check(p_email text, p_pin text, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare tp public.teacher_pins;
begin
  select * into tp from public.teacher_pins where email = lower(trim(coalesce(p_email, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'bad_login'); end if;
  if tp.locked_until is not null and tp.locked_until > p_now then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  if coalesce(p_pin, '') ~ '^\d{4}$' and tp.pin_hash = extensions.crypt(p_pin, tp.pin_hash) then
    update public.teacher_pins set failed_attempts = 0, locked_until = null where email = tp.email;
    return jsonb_build_object('ok', true, 'email', tp.email);
  end if;
  update public.teacher_pins
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        locked_until = case when failed_attempts + 1 >= 5 then p_now + interval '1 hour' else locked_until end
    where email = tp.email;
  return jsonb_build_object('ok', false, 'error', 'bad_login');
end $$;

revoke execute on function public._teacher_login_check(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public._teacher_login_check(text, text, timestamptz) to service_role;
