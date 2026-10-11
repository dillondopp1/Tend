create or replace function public._new_join_code() returns text
language plpgsql volatile set search_path = '' as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where join_code = code);
  end loop;
  return code;
end $$;

create or replace function public.ensure_teacher() returns public.teachers
language plpgsql security definer set search_path = '' as $$
declare v_email text := auth.jwt() ->> 'email'; t public.teachers;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if v_email is null or v_email like '%@students.tend.invalid'
     or exists (select 1 from public.students where id = auth.uid()) then
    raise exception 'not_a_teacher' using errcode = '42501';
  end if;
  insert into public.teachers (id, email) values (auth.uid(), v_email) on conflict (id) do nothing;
  select * into t from public.teachers where id = auth.uid();
  return t;
end $$;

create or replace function public.create_class(p_name text, p_timezone text default 'America/Denver')
returns public.classes language plpgsql security definer set search_path = '' as $$
declare c public.classes;
begin
  if not exists (select 1 from public.teachers where id = auth.uid()) then
    raise exception 'not_a_teacher' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'bad_timezone' using errcode = '22023';
  end if;
  insert into public.classes (teacher_id, name, join_code, timezone)
  values (auth.uid(), trim(p_name), public._new_join_code(), p_timezone)
  returning * into c;
  return c;
end $$;

create or replace function public.regenerate_join_code(p_class uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.teaches_class(p_class) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_code := public._new_join_code();
  update public.classes set join_code = v_code where id = p_class;
  return v_code;
end $$;

create or replace function public._join_check(p_code text, p_name text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_name text := trim(coalesce(p_name, '')); v_class uuid;
begin
  if char_length(v_name) not between 1 and 24 then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  select id into v_class from public.classes where join_code = upper(trim(coalesce(p_code, '')));
  if v_class is null then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  if exists (select 1 from public.students where class_id = v_class and lower(display_name) = lower(v_name)) then
    return jsonb_build_object('ok', false, 'error', 'name_taken');
  end if;
  return jsonb_build_object('ok', true, 'classId', v_class);
end $$;

create or replace function public._register_student(p_id uuid, p_class uuid, p_name text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_pin, '') !~ '^\d{4}$' then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  insert into public.students (id, class_id, display_name, pin_hash)
  values (p_id, p_class, trim(p_name), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)));
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'name_taken');
end $$;

-- Returns status JSON instead of raising, so the failed-attempt update is never rolled back.
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
    update public.students set failed_attempts = 0, locked_until = null where id = st.id;
    return jsonb_build_object('ok', true, 'studentId', st.id);
  end if;
  update public.students
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        locked_until = case when failed_attempts + 1 >= 5 then p_now + interval '15 minutes' else locked_until end
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
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), failed_attempts = 0, locked_until = null
    where id = p_student;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.ensure_teacher(), public.create_class(text, text),
  public.regenerate_join_code(uuid) to authenticated;
grant execute on function public._join_check(text, text), public._register_student(uuid, uuid, text, text),
  public._login_check(text, text, text, timestamptz), public._reset_pin(uuid, uuid, text) to service_role;
