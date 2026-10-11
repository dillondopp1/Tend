create extension if not exists pgcrypto with schema extensions;

create table public.teachers (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  is_content_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  timezone text not null default 'America/Denver',
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key references auth.users on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);
create unique index students_class_name_uq on public.students (class_id, lower(display_name));

create table public.pets (
  student_id uuid primary key references public.students on delete cascade,
  species text not null check (species in ('fox','bunny','panda','cat','puppy','owl','penguin','axolotl','red_panda','otter','frog','hedgehog','lamb','turtle','koala')),
  color_variant int not null default 0 check (color_variant >= 0),
  name text not null check (char_length(name) between 1 and 20),
  fed numeric not null default 100,
  joy numeric not null default 100,
  stats_at timestamptz not null default now(),
  lifetime_days int not null default 0,
  equipped jsonb not null default '{}'::jsonb
);

create table public.streaks (
  student_id uuid primary key references public.students on delete cascade,
  current int not null default 0,
  best int not null default 0,
  shields int not null default 0 check (shields between 0 and 3),
  last_tended_date date
);

create table public.weeks (
  id int primary key,
  start_date date not null,
  end_date date not null,
  title text not null,
  scripture_block text not null,
  manual_url text not null,
  key_phrase text not null,
  content jsonb not null,
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_at timestamptz,
  check (end_date = start_date + 6)
);

create table public.daily_activity (
  student_id uuid not null references public.students on delete cascade,
  date date not null,
  week_id int references public.weeks,
  spark_done_at timestamptz,
  games_played int not null default 0,
  was_catch_up boolean not null default false,
  primary key (student_id, date)
);

create table public.unlocks (
  student_id uuid not null references public.students on delete cascade,
  item_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.students on delete cascade,
  date date not null,
  week_id int references public.weeks,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.game_scores (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  game text not null check (game in ('glide','dash','gather','stack','catch')),
  week_id int references public.weeks,
  score int not null check (score >= 0),
  duration_ms int not null,
  created_at timestamptz not null default now()
);
create index game_scores_board_idx on public.game_scores (class_id, week_id, game, score desc);
create index game_scores_student_idx on public.game_scores (student_id, game, score desc);
