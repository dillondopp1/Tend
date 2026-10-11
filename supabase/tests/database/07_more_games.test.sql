begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table t as select gen_random_uuid() as teacher, gen_random_uuid() as cls, gen_random_uuid() as kid;
insert into auth.users (id, email) select teacher, teacher::text || '@teacher.test' from t;
insert into public.teachers (id, email) select teacher, teacher::text || '@teacher.test' from t;
insert into public.classes (id, teacher_id, name, join_code) select cls, teacher, 'C', upper(substr(md5(cls::text), 1, 6)) from t;
insert into auth.users (id, email) select kid, kid::text || '@students.tend.invalid' from t;
insert into public.students (id, class_id, display_name, pin_hash) select kid, cls, 'Ana', 'x' from t;
insert into public.pets (student_id, species, name) select kid, 'fox', 'Rusty' from t;

select lives_ok($$ select public._record_game((select kid from t), 'run', 900, 30000, now()) $$, 'run accepted');
select lives_ok($$ select public._record_game((select kid from t), 'launch', 1500, 30000, now()) $$, 'launch accepted');
select lives_ok($$ select public._record_game((select kid from t), 'slice', 300, 30000, now()) $$, 'slice accepted');
select throws_ok($$ select public._record_game((select kid from t), 'slice', 5000, 30000, now()) $$, '22023', 'implausible_score', 'slice cap');
select throws_ok($$ select public._record_game((select kid from t), 'pong', 1, 30000, now()) $$, '22023', 'bad_game', 'unknown game');
select is((select count(*)::int from public.game_scores where student_id = (select kid from t)), 3, 'three rows saved');

select * from finish();
rollback;
