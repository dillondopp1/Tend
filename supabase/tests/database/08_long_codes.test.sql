begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('t.t', gen_random_uuid()::text, true);
insert into auth.users (id, email) values (current_setting('t.t')::uuid, 'longcode@example.com');
insert into public.teachers (id, email) values (current_setting('t.t')::uuid, 'longcode@example.com');

select lives_ok($$insert into public.classes (teacher_id, name, join_code) values (current_setting('t.t')::uuid, 'Long', 'STONEHAVEN')$$, '10-character code allowed');
select lives_ok($$insert into public.classes (teacher_id, name, join_code) values (current_setting('t.t')::uuid, 'Six', 'ABC234')$$, '6-character code still allowed');
select throws_ok($$insert into public.classes (teacher_id, name, join_code) values (current_setting('t.t')::uuid, 'Short', 'ABC')$$, '23514', null, '3 characters refused');
select throws_ok($$insert into public.classes (teacher_id, name, join_code) values (current_setting('t.t')::uuid, 'Long', 'ABCDEFGHIJKLM')$$, '23514', null, '13 characters refused');
select throws_ok($$insert into public.classes (teacher_id, name, join_code) values (current_setting('t.t')::uuid, 'Lower', 'stonehaven2')$$, '23514', null, 'lowercase refused');
select is(public._join_check('stonehaven', 'Sam')->>'ok', 'true', 'join check finds the long code, case-insensitive');

select * from finish();
rollback;
