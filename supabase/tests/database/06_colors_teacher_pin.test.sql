begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.teacher_pins (email, pin_hash) values ('t@test.dev', extensions.crypt('1234', extensions.gen_salt('bf', 4)));

select is(public._teacher_login_check('T@test.dev ', '1234', '2026-10-12 12:00+00')->>'ok', 'true', 'right PIN, email case/space ignored');
select is(public._teacher_login_check('t@test.dev', '9999', '2026-10-12 12:00+00')->>'error', 'bad_login', 'wrong PIN');
select is(public._teacher_login_check('nobody@test.dev', '1234', '2026-10-12 12:00+00')->>'error', 'bad_login', 'unknown email');
select public._teacher_login_check('t@test.dev', '0000', '2026-10-12 12:00+00') from generate_series(1, 4);
select is(public._teacher_login_check('t@test.dev', '1234', '2026-10-12 12:01+00')->>'error', 'locked', 'locked after 5 misses');
select is(public._teacher_login_check('t@test.dev', '1234', '2026-10-12 13:01+00')->>'ok', 'true', 'unlocks after an hour');

select is(has_function_privilege('anon', 'public._teacher_login_check(text,text,timestamptz)', 'execute'), false, 'anon cannot check PINs');
select is(has_function_privilege('authenticated', 'public._teacher_login_check(text,text,timestamptz)', 'execute'), false, 'users cannot check PINs');
select is(has_table_privilege('authenticated', 'public.teacher_pins', 'select'), false, 'PIN hashes are unreadable');
select is(has_function_privilege('authenticated', 'public.recolor_pet(int)', 'execute'), true, 'students can recolour');
select is(has_function_privilege('anon', 'public.recolor_pet(int)', 'execute'), false, 'anon cannot recolour');

select * from finish();
rollback;
