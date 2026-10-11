# Tend Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working local Tend skeleton: students join a class with code+name+PIN, adopt a pet, and the server tracks stats, streaks, shields, growth and game scores; teachers sign in and create classes; the app installs as a PWA with the iOS/Android install prompt.

**Architecture:** React+TS (Vite) PWA talks to a **local** Supabase stack (CLI + Docker). All game-state rules (decay, streaks, shields, milestones, growth, score sanity) live in Postgres `security definer` functions so the client can't tamper; the client only mirrors decay for smooth display. Student PIN sign-in is done by Edge Functions that verify the PIN in SQL and mint a normal Supabase session via `generateLink` → `verifyOtp`.

**Tech Stack:** Vite, React, TypeScript, react-router (v7), @supabase/supabase-js v2, vite-plugin-pwa, @vite-pwa/assets-generator, Vitest, Supabase CLI (`npx supabase`), pgTAP, Deno Edge Functions.

**Spec:** `docs/superpowers/specs/2026-10-11-tend-design.md`

## Plan series (this is 1 of 5)

1. **Foundation** (this plan): scaffold, local Supabase, schema/RLS, game-state SQL, auth, PWA/install, bare screens.
2. **Pets & Home:** 15-species SVG rig + animations, adopt flow, home screen, celebrations, closet/equip RPC.
3. **Content & Spark:** week JSON schema + validator + seed script, Spark story cards, reflections, admin Review/approve, write lessons 42–52.
4. **Games:** canvas engine, Glide/Dash/Gather/Stack/Catch, weekly theming + key phrase, game over Sparks, `class_leaderboard`.
5. **Teacher dashboard & launch:** roster/dashboard RPCs, PIN reset UI, cloud Supabase push, Netlify deploy.

## Global Constraints

- Students sign in with class code + display name + 4-digit PIN; no student emails. Synthetic auth email: `<uuid>@students.tend.invalid`.
- Lockout: 5 wrong PINs → locked 15 minutes. Error text never reveals whether a name exists.
- Stats: `fed` and `joy` 0–100, linear decay 100→0 over 72 hours, computed lazily from `stats_at`.
- Spark sets Fed = 100. Each finished game run adds +25 Joy (cap 100).
- Mood (from the lower stat): thriving ≥ 70, content ≥ 40, sleepy ≥ 15, otherwise "misses-you". The pet never dies.
- Growth by `lifetime_days`: hatchling 0, little 3, young 10, grown 25, legendary 50.
- Streak counts only when that day's Spark is completed on that day. Shields: +1 per 7 consecutive days, max 3, auto-spent per missed day. `best` and `lifetime_days` never decrease.
- Milestones: 3, 7, 14, 21, 30, 50, 75, 100.
- A day is the calendar date in the class's time zone (default `America/Denver`). Weeks run Monday–Sunday.
- Current week: the approved week containing the date, else the most recent approved week starting on or before it.
- Catch-up: any earlier date in the current Mon–Sun week. It feeds the pet and adds lifetime days, but never extends the streak.
- Reflections are readable only by their author. No policy grants teachers or admins access.
- Species ids (exact): `fox, bunny, panda, cat, puppy, owl, penguin, axolotl, red_panda, otter, frog, hedgehog, lamb, turtle, koala`.
- Games ids (exact): `glide, dash, gather, stack, catch`. Score caps (points per second of play, +50 allowance): glide 2, dash 40, gather 500, stack 3, catch 10.
- Service role key never reaches the front end.
- All copy shown to students is positive; no failure language around streaks.

## Review Focus

1. **"Sam" vs "sam " in the same class:** names are trimmed and compared case-insensitively for both join and login. (Task 5 test `join_check rejects case/space variant`.)
2. **Just after local midnight:** a student in Denver at 23:30 MDT (05:30 UTC next day) is still on the earlier date; a Spark for the UTC date is refused as future. (Task 4 test `timezone: local date`.)
3. **Double-tap Feed:** completing the same day's Spark twice must not double-count lifetime days or streak. (Task 4 test `second spark same day`.)
4. **PIN guessing:** the failed-attempt counter must persist, not be rolled back by an exception. `_login_check` returns status JSON instead of raising. (Task 5 lockout tests.)
5. **A signed-in student calling service-only functions** (`_login_check`, `_reset_pin`) must get permission denied. (Task 3 test `student cannot execute service-only functions`.)

---

## File map

```
tend/
  package.json, vite.config.ts, tsconfig.json, index.html, .gitignore
  pwa-assets.config.ts, public/icon.svg
  .claude/launch.json
  scripts/write-env.mjs                 — writes .env.local / .env.test.local from `supabase status`
  src/main.tsx                          — mounts app, captures beforeinstallprompt early
  src/App.tsx                           — routes
  src/styles.css
  src/lib/supabase.ts                   — browser client from env
  src/lib/functions.ts                  — Edge Function caller + student session (no import.meta; testable)
  src/lib/studentAuth.ts                — joinClass / signInStudent bound to browser client
  src/lib/api.ts                        — typed RPC wrappers + AppState types
  src/lib/messages.ts                   — friendly error text
  src/lib/useSession.ts                 — session hook + isStudentEmail
  src/domain/stats.ts (+ .test.ts)      — display decay + mood
  src/domain/growth.ts (+ .test.ts)     — stage from lifetime days
  src/domain/species.ts                 — 15 species ids + labels
  src/install/platform.ts (+ .test.ts)  — install platform detection
  src/install/InstallPrompt.tsx         — full-screen card / banner
  src/screens/Welcome.tsx, Join.tsx, Login.tsx, Adopt.tsx, Home.tsx
  src/screens/teacher/TeacherLogin.tsx, TeacherHome.tsx
  supabase/config.toml                  — from `supabase init`, edited
  supabase/migrations/20261011000001_schema.sql
  supabase/migrations/20261011000002_rls.sql
  supabase/migrations/20261011000003_game_logic.sql
  supabase/migrations/20261011000004_accounts.sql
  supabase/seed.sql                     — DEV placeholder week (replaced in Plan 3)
  supabase/tests/database/01_rls.test.sql
  supabase/tests/database/02_game_logic.test.sql
  supabase/tests/database/03_accounts.test.sql
  supabase/functions/_shared/http.ts, _shared/admin.ts
  supabase/functions/student-join/index.ts
  supabase/functions/student-login/index.ts
  supabase/functions/reset-student-pin/index.ts
  tests/integration/auth.test.ts
```

---

### Task 1: Scaffold the app and tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/domain/species.ts`, `src/domain/species.test.ts`

**Interfaces:**
- Produces: `SPECIES` (readonly array of `{ id: SpeciesId; label: string }`), `type SpeciesId`, npm scripts `dev`, `build`, `test`, `test:int`, `db:test`, `env`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run --dir src",
    "test:int": "vitest run --dir tests/integration",
    "db:test": "npx supabase test db",
    "env": "node scripts/write-env.mjs",
    "icons": "pwa-assets-generator"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom react-router @supabase/supabase-js
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest vite-plugin-pwa @vite-pwa/assets-generator supabase
```
Expected: installs without errors. (`supabase` dev dependency makes `npx supabase` use a pinned CLI.)

- [ ] **Step 3: Create config files**

`tsconfig.json` (one config; `supabase/functions` is Deno and deliberately excluded):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "vite.config.ts", "pwa-assets.config.ts"]
}
```

`vite.config.ts` (PWA added in Task 9):
```ts
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, host: true },
  test: { env: loadEnv(mode === 'test' ? 'test' : mode, process.cwd(), '') },
}));
```

Run `npm install -D @types/node`.

`.gitignore`:
```
node_modules
dist
dev-dist
.env*.local
supabase/.temp
supabase/.branches
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#7C5CFF" />
    <title>Tend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write the failing species test**

`src/domain/species.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SPECIES } from './species';

describe('SPECIES', () => {
  it('has exactly the 15 spec species with unique ids', () => {
    const ids = SPECIES.map((s) => s.id);
    expect(ids).toEqual([
      'fox', 'bunny', 'panda', 'cat', 'puppy', 'owl', 'penguin', 'axolotl',
      'red_panda', 'otter', 'frog', 'hedgehog', 'lamb', 'turtle', 'koala',
    ]);
    expect(new Set(ids).size).toBe(15);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `./species`.

- [ ] **Step 6: Implement `src/domain/species.ts`**

```ts
export const SPECIES = [
  { id: 'fox', label: 'Fox' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'panda', label: 'Panda' },
  { id: 'cat', label: 'Cat' },
  { id: 'puppy', label: 'Puppy' },
  { id: 'owl', label: 'Owl' },
  { id: 'penguin', label: 'Penguin' },
  { id: 'axolotl', label: 'Axolotl' },
  { id: 'red_panda', label: 'Red Panda' },
  { id: 'otter', label: 'Otter' },
  { id: 'frog', label: 'Frog' },
  { id: 'hedgehog', label: 'Hedgehog' },
  { id: 'lamb', label: 'Lamb' },
  { id: 'turtle', label: 'Turtle' },
  { id: 'koala', label: 'Koala' },
] as const;

export type SpeciesId = (typeof SPECIES)[number]['id'];
```

- [ ] **Step 7: Create the minimal app shell**

`src/styles.css`:
```css
:root {
  --bg: #fff8ee; --ink: #2b2140; --accent: #7c5cff; --accent-2: #ff8a5c; --muted: #8a7f9e; --card: #ffffff;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--ink); background: var(--bg);
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100dvh; background: var(--bg); }
main { max-width: 480px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px 32px; }
h1 { font-size: 1.8rem; margin: 0.5rem 0 1rem; }
label { display: block; font-weight: 600; margin: 12px 0 4px; }
input, select { width: 100%; font-size: 1.1rem; padding: 12px; border-radius: 12px; border: 2px solid #e4dcf5; background: #fff; }
button { font-size: 1.1rem; font-weight: 700; padding: 14px 18px; border-radius: 14px; border: 0; background: var(--accent); color: #fff; width: 100%; margin-top: 16px; cursor: pointer; }
button.secondary { background: #ece6ff; color: var(--accent); }
.error { color: #c2410c; font-weight: 600; margin-top: 12px; }
.card { background: var(--card); border-radius: 20px; padding: 16px; box-shadow: 0 4px 16px rgba(43,33,64,0.08); margin-top: 16px; }
.bar { height: 14px; background: #eee6ff; border-radius: 99px; overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--accent-2); }
```

`src/App.tsx` (routes fleshed out in Task 8):
```tsx
export default function App() {
  return <main><h1>Tend</h1></main>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verify tests and build pass**

Run: `npm test` → PASS. Run: `npm run build` → succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tend app (Vite, React, Vitest)"
```

---

### Task 2: Local Supabase stack and env wiring

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `scripts/write-env.mjs`, `src/lib/supabase.ts`

**Interfaces:**
- Produces: `.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; `.env.test.local` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `supabase` browser client export.

- [ ] **Step 1: Init and start Supabase**

Run:
```bash
npx supabase init
npx supabase start
```
Expected: `supabase/config.toml` exists; `start` prints API URL `http://127.0.0.1:54321`, Studio, Mailpit (54324) and keys. Docker Desktop must be running.

- [ ] **Step 2: Edit `supabase/config.toml` auth URLs and function JWT settings**

In the `[auth]` section set:
```toml
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173", "http://127.0.0.1:5173"]
```
Append at the end of the file:
```toml
[functions.student-join]
verify_jwt = false

[functions.student-login]
verify_jwt = false

[functions.reset-student-pin]
verify_jwt = false
```
(`reset-student-pin` verifies the teacher token itself; the other two are public by design.)

- [ ] **Step 3: Write `scripts/write-env.mjs`**

```js
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
const vars = Object.fromEntries(
  out.split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = vars.API_URL;
const anon = vars.ANON_KEY ?? vars.PUBLISHABLE_KEY;
const service = vars.SERVICE_ROLE_KEY ?? vars.SECRET_KEY;
if (!url || !anon || !service) {
  console.error('Could not read API_URL / ANON_KEY / SERVICE_ROLE_KEY from `supabase status`. Is it running?');
  process.exit(1);
}
writeFileSync('.env.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${anon}\n`);
writeFileSync('.env.test.local', `SUPABASE_URL=${url}\nSUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\n`);
console.log('Wrote .env.local and .env.test.local for', url);
```

Run: `npm run env`
Expected: "Wrote .env.local and .env.test.local for http://127.0.0.1:54321".

- [ ] **Step 4: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 5: Commit** (env files are gitignored)

```bash
git add -A
git commit -m "chore: local Supabase stack and env script"
```

---

### Task 3: Schema, RLS and grants

**Files:**
- Create: `supabase/migrations/20261011000001_schema.sql`, `supabase/migrations/20261011000002_rls.sql`, `supabase/tests/database/01_rls.test.sql`

**Interfaces:**
- Produces tables: `teachers, classes, students, pets, streaks, daily_activity, unlocks, reflections, weeks, game_scores`; helper functions `is_content_admin()`, `teaches_class(uuid)`, `teaches_student(uuid)`, `my_class_id()`. Default privileges: new functions in `public` are NOT executable by `anon`/`authenticated` unless explicitly granted.

- [ ] **Step 1: Write `20261011000001_schema.sql`**

```sql
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
```

- [ ] **Step 2: Write `20261011000002_rls.sql`**

```sql
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
```

- [ ] **Step 3: Write the failing RLS test `supabase/tests/database/01_rls.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create or replace function pg_temp.mk_class(p_tz text default 'America/Denver') returns uuid language plpgsql as $$
declare t uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (t, t::text || '@teacher.test');
  insert into public.teachers (id, email) values (t, t::text || '@teacher.test');
  insert into public.classes (id, teacher_id, name, join_code, timezone)
    values (c, t, 'Test', upper(substr(md5(c::text), 1, 6)), p_tz);
  return c;
end $$;

create or replace function pg_temp.mk_student(p_class uuid, p_name text default 'kid') returns uuid language plpgsql as $$
declare s uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (s, s::text || '@students.tend.invalid');
  insert into public.students (id, class_id, display_name, pin_hash)
    values (s, p_class, p_name || substr(s::text, 1, 4), extensions.crypt('1234', extensions.gen_salt('bf', 4)));
  insert into public.pets (student_id, species, name) values (s, 'fox', 'Rusty');
  insert into public.streaks (student_id) values (s);
  return s;
end $$;

create or replace function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

select set_config('t.class_a', pg_temp.mk_class()::text, true);
select set_config('t.class_b', pg_temp.mk_class()::text, true);
select set_config('t.stu_a', pg_temp.mk_student(current_setting('t.class_a')::uuid)::text, true);
select set_config('t.stu_b', pg_temp.mk_student(current_setting('t.class_b')::uuid)::text, true);
select set_config('t.teacher_a', (select teacher_id::text from public.classes where id = current_setting('t.class_a')::uuid), true);
insert into public.reflections (student_id, date, body) values (current_setting('t.stu_a')::uuid, '2026-10-12', 'private thought');
insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status)
values (41, '2026-10-05', '2026-10-11', 'W41', 'Isaiah 50–57', 'u', 'kp', '{}', 'approved'),
       (42, '2026-10-12', '2026-10-18', 'W42', 'Isaiah 58–66', 'u', 'kp', '{}', 'draft');

-- Student A
select pg_temp.act_as(current_setting('t.stu_a')::uuid);
select is((select count(*)::int from public.students), 1, 'student sees only own student row');
select is((select count(*)::int from public.pets), 1, 'student sees only own pet');
select is((select count(*)::int from public.classes), 1, 'student sees only own class');
select throws_ok('select pin_hash from public.students', '42501', null, 'student cannot read pin_hash');
select throws_ok($$update public.streaks set current = 99$$, '42501', null, 'student cannot write streaks directly');
select is((select count(*)::int from public.weeks), 1, 'student sees approved weeks only');
select is((select count(*)::int from public.reflections), 1, 'student sees own reflection');
select throws_ok($$select public._login_check('AAAAAA','x','1234', now())$$, '42501', null,
  'student cannot execute service-only functions');
reset role;

-- Teacher A
select pg_temp.act_as(current_setting('t.teacher_a')::uuid);
select is((select count(*)::int from public.students), 1, 'teacher sees own class students only');
select is((select count(*)::int from public.reflections), 0, 'teacher cannot read reflections');
select is((select count(*)::int from public.weeks), 1, 'non-admin teacher sees approved weeks only');
reset role;

select * from finish();
rollback;
```
(The `_login_check` line passes once Task 5 adds that function. Until then it fails with "function does not exist" and is expected to.)

- [ ] **Step 4: Apply migrations and run DB tests**

Run: `npx supabase db reset` then `npm run db:test`
Expected: every assertion passes except `student cannot execute service-only functions` (missing until Task 5).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): schema, RLS policies and grants with pgTAP tests"
```

---

### Task 4: Game-state logic in SQL (decay, streaks, shields, sparks, games)

**Files:**
- Create: `supabase/migrations/20261011000003_game_logic.sql`, `supabase/tests/database/02_game_logic.test.sql`

**Interfaces:**
- Consumes: tables from Task 3.
- Produces (internal, tests call directly): `_local_date(text, timestamptz) → date`, `_week_for_date(date) → int`, `_decayed(numeric, timestamptz, timestamptz) → numeric`, `_growth_stage(int) → text`, `_milestone_reward(int) → text`, `_sync_streak(uuid, date) → jsonb {shieldsUsed:int, streakReset:bool}`, `_complete_spark(uuid, date, timestamptz) → jsonb`, `_record_game(uuid, text, int, int, timestamptz) → jsonb`, `_sync_pet(uuid, timestamptz) → jsonb`.
- Produces (client RPCs, `authenticated`): `sync_pet() → jsonb`, `adopt_pet(p_species text, p_color int, p_name text) → jsonb`, `complete_spark(p_date date) → jsonb`, `record_game(p_game text, p_score int, p_duration_ms int) → jsonb`.
- `_complete_spark` returns: `{firstTime, streakExtended, streak, best, shields, shieldsUsed, streakReset, milestoneReward, lifetimeDays, stage}`.
- `_record_game` returns: `{personalBest, isNewBest, joy}`.
- `_sync_pet` returns: `{today, monday, weekId, awayHours, pet:{species,colorVariant,name,fed,joy,statsAt,lifetimeDays,stage,equipped}|null, streak:{current,best,shields,lastTendedDate}, events:{shieldsUsed,streakReset}, sparksDone:[date], unlocks:[text]}`.

- [ ] **Step 1: Write the failing test `supabase/tests/database/02_game_logic.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create or replace function pg_temp.mk_class(p_tz text default 'America/Denver') returns uuid language plpgsql as $$
declare t uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (t, t::text || '@teacher.test');
  insert into public.teachers (id, email) values (t, t::text || '@teacher.test');
  insert into public.classes (id, teacher_id, name, join_code, timezone)
    values (c, t, 'Test', upper(substr(md5(c::text), 1, 6)), p_tz);
  return c;
end $$;

create or replace function pg_temp.mk_student(p_class uuid, p_name text default 'kid') returns uuid language plpgsql as $$
declare s uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (s, s::text || '@students.tend.invalid');
  insert into public.students (id, class_id, display_name, pin_hash)
    values (s, p_class, p_name || substr(s::text, 1, 4), extensions.crypt('1234', extensions.gen_salt('bf', 4)));
  insert into public.pets (student_id, species, name, stats_at) values (s, 'fox', 'Rusty', '2026-10-12 06:00+00');
  insert into public.streaks (student_id) values (s);
  return s;
end $$;

insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status)
values (41, '2026-10-05', '2026-10-11', 'W41', 'b', 'u', 'kp', '{}', 'approved'),
       (42, '2026-10-12', '2026-10-18', 'W42', 'b', 'u', 'kp', '{}', 'draft'),
       (52, '2026-12-21', '2026-12-27', 'W52', 'b', 'u', 'kp', '{}', 'approved');

-- Time and weeks
select is(public._local_date('America/Denver', '2026-10-13 05:30+00'), '2026-10-12'::date, 'timezone: local date');
select is(public._week_for_date('2026-10-14'), 41, 'unapproved week falls back to latest approved');
update public.weeks set status = 'approved' where id = 42;
select is(public._week_for_date('2026-10-14'), 42, 'approved week containing the date wins');
select is(public._week_for_date('2026-12-30'), 52, 'after Christmas lesson keeps showing 52');
select is(public._week_for_date('2026-01-01'), null::int, 'no week before any content');

-- Decay and growth
select is(round(public._decayed(100, '2026-10-12 00:00+00', '2026-10-13 12:00+00'), 3), 50::numeric, 'decay 36h = 50');
select is(public._decayed(100, '2026-10-12 00:00+00', '2026-10-20 00:00+00'), 0::numeric, 'decay floors at 0');
select is(public._growth_stage(0), 'hatchling', 'stage 0');
select is(public._growth_stage(3), 'little', 'stage 3');
select is(public._growth_stage(10), 'young', 'stage 10');
select is(public._growth_stage(25), 'grown', 'stage 25');
select is(public._growth_stage(50), 'legendary', 'stage 50');

-- Spark: first time today (Mon Oct 12, noon MDT = 18:00 UTC)
select set_config('t.c', pg_temp.mk_class()::text, true);
select set_config('t.s', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
select set_config('t.r', public._complete_spark(current_setting('t.s')::uuid, '2026-10-12', '2026-10-12 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'first spark: streak 1');
select is((current_setting('t.r')::jsonb->>'firstTime')::boolean, true, 'first spark: firstTime');
select is((select fed from public.pets where student_id = current_setting('t.s')::uuid), 100::numeric, 'spark sets fed 100');
select is((select lifetime_days from public.pets where student_id = current_setting('t.s')::uuid), 1, 'lifetime 1');

-- Second spark same day: no double count
select set_config('t.r', public._complete_spark(current_setting('t.s')::uuid, '2026-10-12', '2026-10-12 19:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'firstTime')::boolean, false, 'second spark same day: not first');
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'second spark same day: streak unchanged');
select is((select lifetime_days from public.pets where student_id = current_setting('t.s')::uuid), 1, 'second spark same day: lifetime unchanged');

-- Next day extends
select set_config('t.r', public._complete_spark(current_setting('t.s')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 2, 'next day: streak 2');

-- Out of range dates
select throws_ok(format($$select public._complete_spark(%L, '2026-10-15', '2026-10-13 18:00+00')$$, current_setting('t.s')), '22023', null, 'future date refused');
select throws_ok(format($$select public._complete_spark(%L, '2026-10-11', '2026-10-13 18:00+00')$$, current_setting('t.s')), '22023', null, 'date before Monday refused');
select throws_ok(format($$select public._complete_spark(%L, '2026-10-13', '2026-10-13 05:30+00')$$, current_setting('t.s')), '22023', null, 'UTC date that is still yesterday locally is future');

-- Catch-up: new student does Wednesday then catches up Monday
select set_config('t.s2', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
select public._complete_spark(current_setting('t.s2')::uuid, '2026-10-14', '2026-10-14 18:00+00');
select set_config('t.r', public._complete_spark(current_setting('t.s2')::uuid, '2026-10-12', '2026-10-14 18:05+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'catch-up does not extend streak');
select is((select lifetime_days from public.pets where student_id = current_setting('t.s2')::uuid), 2, 'catch-up adds lifetime day');
select is((select was_catch_up from public.daily_activity where student_id = current_setting('t.s2')::uuid and date = '2026-10-12'), true, 'catch-up flagged');

-- Streak break with no shields keeps best, never negative
select set_config('t.s3', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 5, best = 5, shields = 0, last_tended_date = '2026-10-10' where student_id = current_setting('t.s3')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s3')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streakReset')::boolean, true, 'break reported');
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'break: new streak starts at 1');
select is((current_setting('t.r')::jsonb->>'best')::int, 5, 'break: best kept');

-- Shield covers a one-day gap
select set_config('t.s4', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 7, best = 7, shields = 1, last_tended_date = '2026-10-11' where student_id = current_setting('t.s4')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s4')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'shieldsUsed')::int, 1, 'shield used');
select is((current_setting('t.r')::jsonb->>'streak')::int, 8, 'shield kept streak going');
select is((current_setting('t.r')::jsonb->>'shields')::int, 0, 'shield spent');

-- Gap bigger than shields: break, shields kept
select set_config('t.s5', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 9, best = 9, shields = 1, last_tended_date = '2026-10-10' where student_id = current_setting('t.s5')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s5')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'streak')::int, 1, 'gap > shields breaks');
select is((current_setting('t.r')::jsonb->>'shields')::int, 1, 'shields not spent on a lost cause');

-- Zero streak never spends shields
select set_config('t.s6', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 0, best = 3, shields = 2, last_tended_date = '2026-10-11' where student_id = current_setting('t.s6')::uuid;
select is((public._sync_streak(current_setting('t.s6')::uuid, '2026-10-13')->>'shieldsUsed')::int, 0, 'zero streak keeps shields');

-- Day 7 earns a shield and the scarf; cap at 3
select set_config('t.s7', pg_temp.mk_student(current_setting('t.c')::uuid)::text, true);
update public.streaks set current = 6, best = 6, shields = 0, last_tended_date = '2026-10-12' where student_id = current_setting('t.s7')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s7')::uuid, '2026-10-13', '2026-10-13 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'shields')::int, 1, 'day 7 earns shield');
select is(current_setting('t.r')::jsonb->>'milestoneReward', 'acc_scarf', 'day 7 milestone reward');
select ok(exists(select 1 from public.unlocks where student_id = current_setting('t.s7')::uuid and item_id = 'acc_scarf'), 'reward unlocked');
update public.streaks set current = 27, shields = 3, last_tended_date = '2026-10-13' where student_id = current_setting('t.s7')::uuid;
select set_config('t.r', public._complete_spark(current_setting('t.s7')::uuid, '2026-10-14', '2026-10-14 18:00+00')::text, true);
select is((current_setting('t.r')::jsonb->>'shields')::int, 3, 'shields cap at 3');

-- Games
select set_config('t.g', public._record_game(current_setting('t.s')::uuid, 'glide', 20, 30000, '2026-10-13 20:00+00')::text, true);
select is((current_setting('t.g')::jsonb->>'isNewBest')::boolean, true, 'first score is a best');
select set_config('t.g', public._record_game(current_setting('t.s')::uuid, 'glide', 10, 30000, '2026-10-13 20:05+00')::text, true);
select is((current_setting('t.g')::jsonb->>'personalBest')::int, 20, 'personal best kept');
select is((current_setting('t.g')::jsonb->>'isNewBest')::boolean, false, 'lower score not best');
select throws_ok(format($$select public._record_game(%L, 'glide', 500, 10000, now())$$, current_setting('t.s')), '22023', null, 'implausible score refused');
select throws_ok(format($$select public._record_game(%L, 'tetris', 5, 10000, now())$$, current_setting('t.s')), '22023', null, 'unknown game refused');
select is((select games_played from public.daily_activity where student_id = current_setting('t.s')::uuid and date = '2026-10-13'), 2, 'games counted on the day');

-- Joy +25 capped
update public.pets set joy = 90, fed = 90, stats_at = '2026-10-13 21:00+00' where student_id = current_setting('t.s')::uuid;
select public._record_game(current_setting('t.s')::uuid, 'dash', 100, 20000, '2026-10-13 21:00+00');
select is((select joy from public.pets where student_id = current_setting('t.s')::uuid), 100::numeric, 'joy capped at 100');

-- sync_pet shape
select set_config('t.p', public._sync_pet(current_setting('t.s')::uuid, '2026-10-14 18:00+00')::text, true);
select is(current_setting('t.p')::jsonb->>'today', '2026-10-14', 'sync today');
select is(current_setting('t.p')::jsonb->>'monday', '2026-10-12', 'sync monday');
select is((current_setting('t.p')::jsonb->'streak'->>'current')::int, 2, 'sync streak');
select is(jsonb_array_length(current_setting('t.p')::jsonb->'sparksDone'), 2, 'sync sparks done this week');
select is(current_setting('t.p')::jsonb->'pet'->>'stage', 'hatchling', 'sync stage');

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run db:test`
Expected: FAIL, functions `_local_date` etc. do not exist.

- [ ] **Step 3: Write `20261011000003_game_logic.sql`**

```sql
create or replace function public._local_date(p_tz text, p_now timestamptz) returns date
language sql stable set search_path = '' as $$
  select (p_now at time zone p_tz)::date
$$;

create or replace function public._week_for_date(p_date date) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select w.id from public.weeks w where w.status = 'approved' and p_date between w.start_date and w.end_date),
    (select w.id from public.weeks w where w.status = 'approved' and w.start_date <= p_date order by w.start_date desc limit 1))
$$;

create or replace function public._decayed(p_value numeric, p_at timestamptz, p_now timestamptz) returns numeric
language sql immutable set search_path = '' as $$
  select greatest(0::numeric, least(100::numeric,
    p_value - (extract(epoch from greatest(p_now - p_at, interval '0')) / 3600.0) * (100.0 / 72.0)))
$$;

create or replace function public._growth_stage(p_days int) returns text
language sql immutable set search_path = '' as $$
  select case when p_days >= 50 then 'legendary' when p_days >= 25 then 'grown'
              when p_days >= 10 then 'young' when p_days >= 3 then 'little' else 'hatchling' end
$$;

create or replace function public._milestone_reward(p_streak int) returns text
language sql immutable set search_path = '' as $$
  select case p_streak
    when 3 then 'acc_beanie' when 7 then 'acc_scarf' when 14 then 'bg_sunrise' when 21 then 'acc_glasses'
    when 30 then 'color_gold' when 50 then 'acc_crown' when 75 then 'bg_stars' when 100 then 'acc_flower_crown'
  end
$$;

create or replace function public._sync_streak(p_student uuid, p_today date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.streaks; gap int;
begin
  select * into s from public.streaks where student_id = p_student for update;
  if not found or s.last_tended_date is null or s.current = 0 then
    return jsonb_build_object('shieldsUsed', 0, 'streakReset', false);
  end if;
  gap := p_today - s.last_tended_date - 1;
  if gap <= 0 then
    return jsonb_build_object('shieldsUsed', 0, 'streakReset', false);
  end if;
  if gap <= s.shields then
    update public.streaks set shields = shields - gap, last_tended_date = p_today - 1 where student_id = p_student;
    return jsonb_build_object('shieldsUsed', gap, 'streakReset', false);
  end if;
  update public.streaks set current = 0 where student_id = p_student;
  return jsonb_build_object('shieldsUsed', 0, 'streakReset', true);
end $$;

create or replace function public._student_tz(p_student uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.timezone from public.students s join public.classes c on c.id = s.class_id where s.id = p_student
$$;

create or replace function public._complete_spark(p_student uuid, p_date date, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := public._student_tz(p_student);
  v_today date; v_monday date; v_week int; v_already boolean; v_sync jsonb;
  s public.streaks; v_extended boolean := false; v_reward text; v_lifetime int;
begin
  if v_tz is null then raise exception 'not_a_student' using errcode = '42501'; end if;
  v_today := public._local_date(v_tz, p_now);
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  if p_date > v_today or p_date < v_monday then
    raise exception 'spark_date_out_of_range' using errcode = '22023';
  end if;
  v_week := public._week_for_date(p_date);
  if v_week is null then raise exception 'no_content' using errcode = '22023'; end if;

  v_sync := public._sync_streak(p_student, v_today);

  select exists (select 1 from public.daily_activity
                 where student_id = p_student and date = p_date and spark_done_at is not null) into v_already;
  if not v_already then
    insert into public.daily_activity (student_id, date, week_id, spark_done_at, was_catch_up)
    values (p_student, p_date, v_week, p_now, p_date < v_today)
    on conflict (student_id, date) do update
      set spark_done_at = excluded.spark_done_at, week_id = excluded.week_id, was_catch_up = excluded.was_catch_up;
    update public.pets set lifetime_days = lifetime_days + 1 where student_id = p_student;
  end if;

  update public.pets set joy = public._decayed(joy, stats_at, p_now), fed = 100, stats_at = p_now
  where student_id = p_student;

  select * into s from public.streaks where student_id = p_student for update;
  if p_date = v_today and s.last_tended_date is distinct from v_today then
    update public.streaks
      set current = current + 1,
          best = greatest(best, current + 1),
          last_tended_date = v_today,
          shields = case when (current + 1) % 7 = 0 then least(shields + 1, 3) else shields end
      where student_id = p_student
      returning * into s;
    v_extended := true;
    v_reward := public._milestone_reward(s.current);
    if v_reward is not null then
      insert into public.unlocks (student_id, item_id, unlocked_at) values (p_student, v_reward, p_now)
      on conflict do nothing;
    end if;
  end if;

  select lifetime_days into v_lifetime from public.pets where student_id = p_student;
  return jsonb_build_object(
    'firstTime', not v_already, 'streakExtended', v_extended,
    'streak', s.current, 'best', s.best, 'shields', s.shields,
    'shieldsUsed', (v_sync->>'shieldsUsed')::int, 'streakReset', (v_sync->>'streakReset')::boolean,
    'milestoneReward', v_reward, 'lifetimeDays', v_lifetime, 'stage', public._growth_stage(v_lifetime));
end $$;

create or replace function public._record_game(p_student uuid, p_game text, p_score int, p_duration_ms int, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_class uuid; v_tz text; v_today date; v_week int; v_cap numeric; v_prev int; v_joy numeric;
begin
  select s.class_id, c.timezone into v_class, v_tz
  from public.students s join public.classes c on c.id = s.class_id where s.id = p_student;
  if v_class is null then raise exception 'not_a_student' using errcode = '42501'; end if;

  v_cap := case p_game when 'glide' then 2 when 'dash' then 40 when 'gather' then 500
                       when 'stack' then 3 when 'catch' then 10 end;
  if v_cap is null then raise exception 'bad_game' using errcode = '22023'; end if;
  if p_duration_ms is null or p_duration_ms < 1000 or p_duration_ms > 3600000
     or p_score is null or p_score < 0 or p_score > v_cap * p_duration_ms / 1000.0 + 50 then
    raise exception 'implausible_score' using errcode = '22023';
  end if;

  v_today := public._local_date(v_tz, p_now);
  v_week := public._week_for_date(v_today);
  select max(score) into v_prev from public.game_scores where student_id = p_student and game = p_game;

  insert into public.game_scores (student_id, class_id, game, week_id, score, duration_ms, created_at)
  values (p_student, v_class, p_game, v_week, p_score, p_duration_ms, p_now);

  update public.pets
    set fed = public._decayed(fed, stats_at, p_now),
        joy = least(100, public._decayed(joy, stats_at, p_now) + 25),
        stats_at = p_now
    where student_id = p_student
    returning joy into v_joy;

  insert into public.daily_activity (student_id, date, week_id, games_played)
  values (p_student, v_today, v_week, 1)
  on conflict (student_id, date) do update set games_played = public.daily_activity.games_played + 1;

  return jsonb_build_object('personalBest', greatest(coalesce(v_prev, 0), p_score),
                            'isNewBest', v_prev is null or p_score > v_prev, 'joy', v_joy);
end $$;

create or replace function public._sync_pet(p_student uuid, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := public._student_tz(p_student);
  v_today date; v_monday date; v_prev timestamptz; v_sync jsonb; p public.pets; s public.streaks;
  v_done jsonb; v_unlocks jsonb;
begin
  if v_tz is null then raise exception 'not_a_student' using errcode = '42501'; end if;
  v_today := public._local_date(v_tz, p_now);
  v_monday := v_today - (extract(isodow from v_today)::int - 1);
  select last_active_at into v_prev from public.students where id = p_student;
  update public.students set last_active_at = p_now where id = p_student;

  select * into p from public.pets where student_id = p_student;
  if not found then
    return jsonb_build_object('today', v_today, 'monday', v_monday, 'weekId', public._week_for_date(v_today),
                              'awayHours', null, 'pet', null, 'streak', null, 'events', null,
                              'sparksDone', '[]'::jsonb, 'unlocks', '[]'::jsonb);
  end if;

  v_sync := public._sync_streak(p_student, v_today);
  select * into s from public.streaks where student_id = p_student;
  select coalesce(jsonb_agg(date order by date), '[]'::jsonb) into v_done
    from public.daily_activity
    where student_id = p_student and date between v_monday and v_today and spark_done_at is not null;
  select coalesce(jsonb_agg(item_id order by unlocked_at), '[]'::jsonb) into v_unlocks
    from public.unlocks where student_id = p_student;

  return jsonb_build_object(
    'today', v_today, 'monday', v_monday, 'weekId', public._week_for_date(v_today),
    'awayHours', case when v_prev is null then null else round(extract(epoch from p_now - v_prev) / 3600.0, 1) end,
    'pet', jsonb_build_object(
      'species', p.species, 'colorVariant', p.color_variant, 'name', p.name,
      'fed', round(public._decayed(p.fed, p.stats_at, p_now), 1),
      'joy', round(public._decayed(p.joy, p.stats_at, p_now), 1),
      'statsAt', p_now, 'lifetimeDays', p.lifetime_days,
      'stage', public._growth_stage(p.lifetime_days), 'equipped', p.equipped),
    'streak', jsonb_build_object('current', s.current, 'best', s.best, 'shields', s.shields,
                                 'lastTendedDate', s.last_tended_date),
    'events', v_sync, 'sparksDone', v_done, 'unlocks', v_unlocks);
end $$;

-- Client-facing RPCs: always use the caller's identity and the real clock.
create or replace function public.sync_pet() returns jsonb
language sql security definer set search_path = '' as $$
  select public._sync_pet(auth.uid(), now())
$$;

create or replace function public.complete_spark(p_date date) returns jsonb
language sql security definer set search_path = '' as $$
  select public._complete_spark(auth.uid(), p_date, now())
$$;

create or replace function public.record_game(p_game text, p_score int, p_duration_ms int) returns jsonb
language sql security definer set search_path = '' as $$
  select public._record_game(auth.uid(), p_game, p_score, p_duration_ms, now())
$$;

create or replace function public.adopt_pet(p_species text, p_color int, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.students where id = auth.uid()) then
    raise exception 'not_a_student' using errcode = '42501';
  end if;
  if exists (select 1 from public.pets where student_id = auth.uid()) then
    raise exception 'already_adopted' using errcode = '23505';
  end if;
  if p_color is null or p_color not between 0 and 2 then
    raise exception 'bad_color' using errcode = '22023';
  end if;
  insert into public.pets (student_id, species, color_variant, name)
  values (auth.uid(), p_species, p_color, trim(p_name));
  insert into public.streaks (student_id) values (auth.uid()) on conflict do nothing;
  return public._sync_pet(auth.uid(), now());
end $$;

grant execute on function public.sync_pet(), public.complete_spark(date),
  public.record_game(text, int, int), public.adopt_pet(text, int, text) to authenticated;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset` then `npm run db:test`
Expected: `02_game_logic` all pass. (`01_rls` still has its one expected failure until Task 5.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): server-side stats, streaks, shields, sparks and game scoring"
```

---

### Task 5: Account functions (student join/login/lockout, teacher, classes)

**Files:**
- Create: `supabase/migrations/20261011000004_accounts.sql`, `supabase/tests/database/03_accounts.test.sql`

**Interfaces:**
- Produces (service_role only):
  - `_join_check(p_code text, p_name text) → jsonb {ok, classId?, error?}` with errors `bad_name | bad_code | name_taken`
  - `_register_student(p_id uuid, p_class uuid, p_name text, p_pin text) → jsonb {ok, error?}` with errors `bad_pin | name_taken`
  - `_login_check(p_code text, p_name text, p_pin text, p_now timestamptz) → jsonb {ok, studentId?, error?}` with errors `bad_login | locked`
  - `_reset_pin(p_teacher uuid, p_student uuid, p_pin text) → jsonb {ok, error?}` with errors `forbidden | bad_pin`
- Produces (authenticated): `ensure_teacher() → teachers row`, `create_class(p_name text, p_timezone text default 'America/Denver') → classes row`, `regenerate_join_code(p_class uuid) → text`.

- [ ] **Step 1: Write the failing test `supabase/tests/database/03_accounts.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create or replace function pg_temp.act_as(p_uid uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'email', p_email)::text, true);
  execute 'set local role authenticated';
end $$;

-- Teacher creates a class
select set_config('t.t', gen_random_uuid()::text, true);
insert into auth.users (id, email) values (current_setting('t.t')::uuid, 'teach@example.com');
select pg_temp.act_as(current_setting('t.t')::uuid, 'teach@example.com');
select is((public.ensure_teacher()).email, 'teach@example.com', 'ensure_teacher creates row');
select is((public.ensure_teacher()).email, 'teach@example.com', 'ensure_teacher is idempotent');
select set_config('t.class', (public.create_class('Sunday 16s')).id::text, true);
select throws_ok($$select public.create_class('Bad', 'Mars/Olympus')$$, '22023', null, 'bad timezone refused');
reset role;
select set_config('t.code', (select join_code from public.classes where id = current_setting('t.class')::uuid), true);
select matches(current_setting('t.code'), '^[A-HJ-NP-Z2-9]{6}$', 'join code uses unambiguous alphabet');

-- Join check
select is(public._join_check(lower(current_setting('t.code')), ' Sam ')->>'ok', 'true', 'join_check ok, code case-insensitive');
select is(public._join_check('ZZZZZZ', 'Sam')->>'error', 'bad_code', 'join_check bad code');
select is(public._join_check(current_setting('t.code'), '   ')->>'error', 'bad_name', 'join_check blank name');

-- Register
select set_config('t.s', gen_random_uuid()::text, true);
insert into auth.users (id, email) values (current_setting('t.s')::uuid, current_setting('t.s') || '@students.tend.invalid');
select is(public._register_student(current_setting('t.s')::uuid, current_setting('t.class')::uuid, ' Sam ', '12a4')->>'error', 'bad_pin', 'register rejects non-digit pin');
select is(public._register_student(current_setting('t.s')::uuid, current_setting('t.class')::uuid, ' Sam ', '4321')->>'ok', 'true', 'register ok');
select is((select display_name from public.students where id = current_setting('t.s')::uuid), 'Sam', 'name trimmed');
select is(public._join_check(current_setting('t.code'), 'sam ')->>'error', 'name_taken', 'join_check rejects case/space variant');

-- Login
select is(public._login_check(current_setting('t.code'), 'SAM', '4321', now())->>'studentId', current_setting('t.s'), 'login ok case-insensitive');
select is(public._login_check(current_setting('t.code'), 'Nobody', '4321', now())->>'error', 'bad_login', 'unknown name gives generic error');
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 18:00+00') from generate_series(1, 4);
select is((select failed_attempts from public.students where id = current_setting('t.s')::uuid), 4, 'failed attempts persist');
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-12 18:01+00')->>'ok', 'true', '4 misses then correct works');
select is((select failed_attempts from public.students where id = current_setting('t.s')::uuid), 0, 'success resets counter');
select public._login_check(current_setting('t.code'), 'Sam', '0000', '2026-10-12 18:02+00') from generate_series(1, 5);
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-12 18:03+00')->>'error', 'locked', 'locked after 5 misses even with right pin');
select is(public._login_check(current_setting('t.code'), 'Sam', '4321', '2026-10-12 18:18+00')->>'ok', 'true', 'unlocked after 15 minutes');

-- Students can't become teachers
select pg_temp.act_as(current_setting('t.s')::uuid, current_setting('t.s') || '@students.tend.invalid');
select throws_ok('select public.ensure_teacher()', '42501', null, 'student cannot become teacher');
reset role;

-- PIN reset
select is(public._reset_pin(current_setting('t.t')::uuid, current_setting('t.s')::uuid, '9999')->>'ok', 'true', 'teacher resets pin');
select is(public._login_check(current_setting('t.code'), 'Sam', '9999', '2026-10-12 19:00+00')->>'ok', 'true', 'new pin works');
select is(public._reset_pin(gen_random_uuid(), current_setting('t.s')::uuid, '1111')->>'error', 'forbidden', 'other teacher cannot reset');

-- Regenerate code
select pg_temp.act_as(current_setting('t.t')::uuid, 'teach@example.com');
select isnt(public.regenerate_join_code(current_setting('t.class')::uuid), current_setting('t.code'), 'regenerated code differs');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run db:test`
Expected: FAIL, `ensure_teacher` does not exist.

- [ ] **Step 3: Write `20261011000004_accounts.sql`**

```sql
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
```

- [ ] **Step 4: Run all DB tests**

Run: `npx supabase db reset` then `npm run db:test`
Expected: all three files pass, including `student cannot execute service-only functions` in `01_rls`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): student join/login with lockout, teacher and class RPCs"
```

---

### Task 6: Edge Functions for student sign-in and PIN reset

**Files:**
- Create: `supabase/functions/_shared/http.ts`, `supabase/functions/_shared/admin.ts`, `supabase/functions/student-join/index.ts`, `supabase/functions/student-login/index.ts`, `supabase/functions/reset-student-pin/index.ts`, `src/lib/functions.ts`, `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `_join_check`, `_register_student`, `_login_check`, `_reset_pin` (Task 5); `sync_pet` (Task 4).
- Produces HTTP endpoints (POST JSON):
  - `student-join` `{code, name, pin}` → 200 `{tokenHash}` | 400/409 `{error}`
  - `student-login` `{code, name, pin}` → 200 `{tokenHash}` | 401/423 `{error}`
  - `reset-student-pin` `{studentId, pin}` with teacher `Authorization: Bearer <access token>` → 200 `{ok:true}` | 401/403/400 `{error}`
- Produces `src/lib/functions.ts`: `type FnError`, `callFunction<T>(baseUrl, anonKey, name, body, accessToken?)`, `studentSession(client, baseUrl, anonKey, kind, body)`.

- [ ] **Step 1: Write the failing integration test `tests/integration/auth.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { callFunction, studentSession } from '../../src/lib/functions';

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const fresh = () => createClient(URL, ANON, { auth: { persistSession: false } });

let code = '';
let teacherToken = '';
const name = `Kid${Math.floor(Math.random() * 1e6)}`;

beforeAll(async () => {
  const email = `t${Date.now()}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: 'teacher-pass-123', email_confirm: true });
  if (error) throw error;
  await admin.from('teachers').insert({ id: u.user!.id, email });
  code = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'A').padEnd(5, 'A');
  await admin.from('classes').insert({ teacher_id: u.user!.id, name: 'Int Test', join_code: code });
  const t = fresh();
  const { data: s } = await t.auth.signInWithPassword({ email, password: 'teacher-pass-123' });
  teacherToken = s.session!.access_token;
});

describe('student sign-in', () => {
  it('joins, gets a real session, and can call sync_pet', async () => {
    const client = fresh();
    const r = await studentSession(client, URL, ANON, 'student-join', { code, name, pin: '2468' });
    expect(r.ok).toBe(true);
    const { data, error } = await client.rpc('sync_pet');
    expect(error).toBeNull();
    expect(data.pet).toBeNull();
  });

  it('rejects a duplicate name in the same class', async () => {
    const r = await callFunction(URL, ANON, 'student-join', { code, name: name.toLowerCase(), pin: '1111' });
    expect(r).toEqual({ ok: false, error: 'name_taken' });
  });

  it('logs back in with the right PIN and refuses the wrong one', async () => {
    const ok = await studentSession(fresh(), URL, ANON, 'student-login', { code, name, pin: '2468' });
    expect(ok.ok).toBe(true);
    const bad = await callFunction(URL, ANON, 'student-login', { code, name, pin: '0000' });
    expect(bad).toEqual({ ok: false, error: 'bad_login' });
  });

  it('teacher resets the PIN; a student token cannot', async () => {
    const { data: stu } = await admin.from('students').select('id').eq('display_name', name).single();
    const r = await callFunction(URL, ANON, 'reset-student-pin', { studentId: stu!.id, pin: '1357' }, teacherToken);
    expect(r.ok).toBe(true);
    const ok = await studentSession(fresh(), URL, ANON, 'student-login', { code, name, pin: '1357' });
    expect(ok.ok).toBe(true);
    const anonTry = await callFunction(URL, ANON, 'reset-student-pin', { studentId: stu!.id, pin: '1111' });
    expect(anonTry.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int`
Expected: FAIL, cannot resolve `../../src/lib/functions`.

- [ ] **Step 3: Write `src/lib/functions.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type FnError =
  | 'bad_code' | 'name_taken' | 'bad_name' | 'bad_pin' | 'bad_login' | 'locked'
  | 'forbidden' | 'unauthorized' | 'server' | 'network';

export type FnResult<T> = { ok: true; data: T } | { ok: false; error: FnError };

export async function callFunction<T>(
  baseUrl: string, anonKey: string, name: string, body: unknown, accessToken?: string,
): Promise<FnResult<T>> {
  try {
    const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken ?? anonKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (json.error ?? 'server') as FnError };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function studentSession(
  client: SupabaseClient, baseUrl: string, anonKey: string,
  kind: 'student-join' | 'student-login', body: { code: string; name: string; pin: string },
): Promise<FnResult<null>> {
  const r = await callFunction<{ tokenHash: string }>(baseUrl, anonKey, kind, body);
  if (!r.ok) return r;
  const { error } = await client.auth.verifyOtp({ token_hash: r.data.tokenHash, type: 'email' });
  if (error) return { ok: false, error: 'server' };
  return { ok: true, data: null };
}
```

- [ ] **Step 4: Write the shared Edge Function helpers**

`supabase/functions/_shared/http.ts`:
```ts
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null);

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try { return await req.json(); } catch { return {}; }
}
```

`supabase/functions/_shared/admin.ts`:
```ts
import { createClient } from 'npm:@supabase/supabase-js@2';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const STUDENT_EMAIL_DOMAIN = 'students.tend.invalid';

/** Mints a one-time token the client exchanges for a session via verifyOtp. */
export async function tokenHashFor(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) throw error ?? new Error('no token');
  return data.properties.hashed_token;
}
```

- [ ] **Step 5: Write `supabase/functions/student-join/index.ts`**

```ts
import { json, preflight, readBody } from '../_shared/http.ts';
import { admin, STUDENT_EMAIL_DOMAIN, tokenHashFor } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const { code, name, pin } = await readBody(req) as { code?: string; name?: string; pin?: string };
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return json({ error: 'bad_pin' }, 400);

  const { data: check, error: e1 } = await admin.rpc('_join_check', { p_code: code ?? '', p_name: name ?? '' });
  if (e1) return json({ error: 'server' }, 500);
  if (!check.ok) return json({ error: check.error }, check.error === 'name_taken' ? 409 : 400);

  const email = `${crypto.randomUUID()}@${STUDENT_EMAIL_DOMAIN}`;
  const { data: created, error: e2 } = await admin.auth.admin.createUser({
    email, password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: true,
    user_metadata: { role: 'student' },
  });
  if (e2 || !created.user) return json({ error: 'server' }, 500);

  const { data: reg, error: e3 } = await admin.rpc('_register_student', {
    p_id: created.user.id, p_class: check.classId, p_name: name, p_pin: pin,
  });
  if (e3 || !reg.ok) {
    await admin.auth.admin.deleteUser(created.user.id);
    if (e3) return json({ error: 'server' }, 500);
    return json({ error: reg.error }, reg.error === 'name_taken' ? 409 : 400);
  }

  try {
    return json({ tokenHash: await tokenHashFor(email) });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
```

- [ ] **Step 6: Write `supabase/functions/student-login/index.ts`**

```ts
import { json, preflight, readBody } from '../_shared/http.ts';
import { admin, tokenHashFor } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const { code, name, pin } = await readBody(req) as { code?: string; name?: string; pin?: string };

  const { data, error } = await admin.rpc('_login_check', {
    p_code: code ?? '', p_name: name ?? '', p_pin: pin ?? '', p_now: new Date().toISOString(),
  });
  if (error) return json({ error: 'server' }, 500);
  if (!data.ok) return json({ error: data.error }, data.error === 'locked' ? 423 : 401);

  const { data: u, error: e2 } = await admin.auth.admin.getUserById(data.studentId);
  if (e2 || !u.user?.email) return json({ error: 'server' }, 500);
  try {
    return json({ tokenHash: await tokenHashFor(u.user.email) });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
```

- [ ] **Step 7: Write `supabase/functions/reset-student-pin/index.ts`**

```ts
import { json, preflight, readBody } from '../_shared/http.ts';
import { admin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who, error } = await admin.auth.getUser(token);
  if (error || !who.user) return json({ error: 'unauthorized' }, 401);

  const { studentId, pin } = await readBody(req) as { studentId?: string; pin?: string };
  const { data, error: e2 } = await admin.rpc('_reset_pin', {
    p_teacher: who.user.id, p_student: studentId ?? null, p_pin: pin ?? '',
  });
  if (e2) return json({ error: 'server' }, 500);
  if (!data.ok) return json({ error: data.error }, data.error === 'forbidden' ? 403 : 400);
  return json({ ok: true });
});
```

- [ ] **Step 8: Restart so the functions are served, then run integration tests**

Run:
```bash
npx supabase stop
npx supabase start
npm run test:int
```
Expected: 4 tests PASS. If `createUser` rejects the `.invalid` email domain, change `STUDENT_EMAIL_DOMAIN` to `students.tend.test` **and** every `@students.tend.invalid` occurrence in the migrations and pgTAP tests, then `npx supabase db reset` and re-run both `npm run db:test` and `npm run test:int`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(auth): student join/login and teacher PIN reset edge functions"
```

---

### Task 7: Client domain mirror and typed API

**Files:**
- Create: `src/domain/stats.ts`, `src/domain/stats.test.ts`, `src/domain/growth.ts`, `src/domain/growth.test.ts`, `src/lib/api.ts`, `src/lib/messages.ts`, `src/lib/studentAuth.ts`, `src/lib/useSession.ts`

**Interfaces:**
- Produces: `decayed(value, statsAt: Date, now: Date): number`, `moodFor(fed, joy): Mood`, `type Mood = 'thriving'|'content'|'sleepy'|'misses-you'`; `type Stage`, `stageFor(days): Stage`, `nextStage(days): { stage: Stage; atDays: number } | null`; `type AppState`, `syncPet()`, `adoptPet(species, color, name)`, `completeSpark(date)`, `recordGame(game, score, durationMs)`; `errorText(e: FnError): string`; `joinClass(code, name, pin)`, `signInStudent(code, name, pin)`; `useSession(): Session | null | undefined`, `isStudentEmail(email?: string): boolean`.

- [ ] **Step 1: Write the failing tests**

`src/domain/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { decayed, moodFor } from './stats';

const t0 = new Date('2026-10-12T00:00:00Z');
const at = (h: number) => new Date(t0.getTime() + h * 3_600_000);

describe('decayed', () => {
  it('drops 100 to 50 in 36 hours', () => expect(decayed(100, t0, at(36))).toBeCloseTo(50));
  it('floors at 0', () => expect(decayed(100, t0, at(100))).toBe(0));
  it('never rises if the clock is behind', () => expect(decayed(80, t0, at(-5))).toBe(80));
});

describe('moodFor', () => {
  it('uses the lower stat', () => expect(moodFor(95, 45)).toBe('content'));
  it('thresholds', () => {
    expect(moodFor(70, 70)).toBe('thriving');
    expect(moodFor(40, 99)).toBe('content');
    expect(moodFor(15, 99)).toBe('sleepy');
    expect(moodFor(14.9, 99)).toBe('misses-you');
  });
});
```

`src/domain/growth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stageFor, nextStage } from './growth';

describe('growth', () => {
  it('maps lifetime days to stages', () => {
    expect([0, 2, 3, 9, 10, 24, 25, 49, 50].map(stageFor)).toEqual(
      ['hatchling', 'hatchling', 'little', 'little', 'young', 'young', 'grown', 'grown', 'legendary']);
  });
  it('reports the next stage', () => {
    expect(nextStage(4)).toEqual({ stage: 'young', atDays: 10 });
    expect(nextStage(50)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/domain/stats.ts`:
```ts
export const DECAY_PER_HOUR = 100 / 72;

export function decayed(value: number, statsAt: Date, now: Date): number {
  const hours = Math.max(0, (now.getTime() - statsAt.getTime()) / 3_600_000);
  return Math.max(0, Math.min(100, value - hours * DECAY_PER_HOUR));
}

export type Mood = 'thriving' | 'content' | 'sleepy' | 'misses-you';

export function moodFor(fed: number, joy: number): Mood {
  const low = Math.min(fed, joy);
  if (low >= 70) return 'thriving';
  if (low >= 40) return 'content';
  if (low >= 15) return 'sleepy';
  return 'misses-you';
}
```

`src/domain/growth.ts`:
```ts
export type Stage = 'hatchling' | 'little' | 'young' | 'grown' | 'legendary';

const STAGES: { stage: Stage; atDays: number }[] = [
  { stage: 'hatchling', atDays: 0 },
  { stage: 'little', atDays: 3 },
  { stage: 'young', atDays: 10 },
  { stage: 'grown', atDays: 25 },
  { stage: 'legendary', atDays: 50 },
];

export function stageFor(days: number): Stage {
  return [...STAGES].reverse().find((s) => days >= s.atDays)!.stage;
}

export function nextStage(days: number): { stage: Stage; atDays: number } | null {
  return STAGES.find((s) => s.atDays > days) ?? null;
}
```

`src/lib/api.ts`:
```ts
import { supabase } from './supabase';
import type { SpeciesId } from '../domain/species';
import type { Stage } from '../domain/growth';

export type GameId = 'glide' | 'dash' | 'gather' | 'stack' | 'catch';

export interface PetState {
  species: SpeciesId; colorVariant: number; name: string;
  fed: number; joy: number; statsAt: string;
  lifetimeDays: number; stage: Stage; equipped: Record<string, string>;
}

export interface AppState {
  today: string; monday: string; weekId: number | null; awayHours: number | null;
  pet: PetState | null;
  streak: { current: number; best: number; shields: number; lastTendedDate: string | null } | null;
  events: { shieldsUsed: number; streakReset: boolean } | null;
  sparksDone: string[]; unlocks: string[];
}

export interface SparkResult {
  firstTime: boolean; streakExtended: boolean; streak: number; best: number; shields: number;
  shieldsUsed: number; streakReset: boolean; milestoneReward: string | null;
  lifetimeDays: number; stage: Stage;
}

export interface GameResult { personalBest: number; isNewBest: boolean; joy: number }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const syncPet = () => rpc<AppState>('sync_pet');
export const adoptPet = (species: SpeciesId, color: number, name: string) =>
  rpc<AppState>('adopt_pet', { p_species: species, p_color: color, p_name: name });
export const completeSpark = (date: string) => rpc<SparkResult>('complete_spark', { p_date: date });
export const recordGame = (game: GameId, score: number, durationMs: number) =>
  rpc<GameResult>('record_game', { p_game: game, p_score: score, p_duration_ms: Math.round(durationMs) });
```

`src/lib/messages.ts`:
```ts
import type { FnError } from './functions';

const TEXT: Record<FnError, string> = {
  bad_code: "Hmm, that class code didn't work. Double-check it with your teacher!",
  name_taken: 'Someone in your class already has that name. Try adding your last initial!',
  bad_name: 'Pick a name with 1 to 24 letters.',
  bad_pin: 'Your PIN needs to be exactly 4 numbers.',
  bad_login: "That didn't match. Check your class code, name and PIN.",
  locked: 'Too many tries. Take a 15-minute break, or ask your teacher to reset your PIN.',
  forbidden: "You don't have access to that.",
  unauthorized: 'Please sign in again.',
  server: 'Something went wrong on our end. Try again in a moment.',
  network: "Can't reach Tend right now. Check your internet and try again.",
};

export const errorText = (e: FnError) => TEXT[e];
```

`src/lib/studentAuth.ts`:
```ts
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { studentSession } from './functions';

export const joinClass = (code: string, name: string, pin: string) =>
  studentSession(supabase, SUPABASE_URL, SUPABASE_ANON_KEY, 'student-join', { code, name, pin });

export const signInStudent = (code: string, name: string, pin: string) =>
  studentSession(supabase, SUPABASE_URL, SUPABASE_ANON_KEY, 'student-login', { code, name, pin });
```

`src/lib/useSession.ts`:
```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const isStudentEmail = (email?: string) => !!email && email.endsWith('@students.tend.invalid');

/** undefined = still loading, null = signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}
```
(If Task 6 Step 8 switched the domain to `students.tend.test`, use that here too.)

- [ ] **Step 4: Run tests**

Run: `npm test` → PASS. Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(client): stats/mood/growth mirror, typed RPC API, session helpers"
```

---

### Task 8: Bare screens and routing

These screens are deliberately plain. Plan 2 restyles them and adds pet art. The goal here is a working end-to-end loop.

**Files:**
- Create: `src/screens/Welcome.tsx`, `src/screens/Join.tsx`, `src/screens/Login.tsx`, `src/screens/Adopt.tsx`, `src/screens/Home.tsx`, `src/screens/teacher/TeacherLogin.tsx`, `src/screens/teacher/TeacherHome.tsx`
- Modify: `src/App.tsx`
- Create: `supabase/seed.sql`, `.claude/launch.json`

**Interfaces:**
- Consumes: everything from Task 7; `InstallPrompt` from Task 9 (Home renders it; until Task 9 lands, Home omits the import, and Task 9 Step 5 adds it).
- Produces routes: `/`, `/join`, `/login`, `/adopt`, `/home`, `/teacher/login`, `/teacher`.

- [ ] **Step 1: Write `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Welcome from './screens/Welcome';
import Join from './screens/Join';
import Login from './screens/Login';
import Adopt from './screens/Adopt';
import Home from './screens/Home';
import TeacherLogin from './screens/teacher/TeacherLogin';
import TeacherHome from './screens/teacher/TeacherHome';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/join" element={<Join />} />
        <Route path="/login" element={<Login />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/home" element={<Home />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Write the student screens**

`src/screens/Welcome.tsx`:
```tsx
import { Link, Navigate } from 'react-router';
import { useSession, isStudentEmail } from '../lib/useSession';

export default function Welcome() {
  const session = useSession();
  if (session === undefined) return null;
  if (session) return <Navigate to={isStudentEmail(session.user.email) ? '/home' : '/teacher'} replace />;
  return (
    <main>
      <h1>Tend 🌱</h1>
      <p>Adopt a pet. Keep it happy with a tiny spark from this week's Come Follow Me.</p>
      <Link to="/join"><button>Join my class</button></Link>
      <Link to="/login"><button className="secondary">I already have a pet</button></Link>
      <p style={{ marginTop: 32, textAlign: 'center' }}><Link to="/teacher/login">I'm a teacher</Link></p>
    </main>
  );
}
```

`src/screens/Join.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { joinClass } from '../lib/studentAuth';
import { errorText } from '../lib/messages';

export default function Join() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== pin2) return setError("Those PINs don't match. Try again!");
    setBusy(true); setError('');
    const r = await joinClass(code, name, pin);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    nav('/adopt', { replace: true });
  }

  return (
    <main>
      <h1>Join your class</h1>
      <form onSubmit={submit}>
        <label>Class code</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" required />
        <label>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
        <label>Make a 4-number PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
        <label>Type it again</label>
        <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
        <button disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
```

`src/screens/Login.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { signInStudent } from '../lib/studentAuth';
import { errorText } from '../lib/messages';

export default function Login() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await signInStudent(code, name, pin);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    nav('/home', { replace: true });
  }

  return (
    <main>
      <h1>Welcome back!</h1>
      <form onSubmit={submit}>
        <label>Class code</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" required />
        <label>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
        <label>PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} type="password" required />
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
```

`src/screens/Adopt.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SPECIES, type SpeciesId } from '../domain/species';
import { adoptPet } from '../lib/api';

export default function Adopt() {
  const nav = useNavigate();
  const [species, setSpecies] = useState<SpeciesId>('fox');
  const [color, setColor] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await adoptPet(species, color, name);
      nav('/home', { replace: true });
    } catch {
      setError("Couldn't adopt right now. Try again!");
    }
  }

  return (
    <main>
      <h1>Adopt your pet</h1>
      <form onSubmit={submit}>
        <label>Animal</label>
        <select value={species} onChange={(e) => setSpecies(e.target.value as SpeciesId)}>
          {SPECIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label>Color</label>
        <select value={color} onChange={(e) => setColor(Number(e.target.value))}>
          <option value={0}>Classic</option><option value={1}>Pastel</option><option value={2}>Midnight</option>
        </select>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
        <button>Adopt!</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
```

`src/screens/Home.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { syncPet, completeSpark, type AppState } from '../lib/api';
import { decayed, moodFor } from '../domain/stats';
import { useSession, isStudentEmail } from '../lib/useSession';
import { supabase } from '../lib/supabase';

export default function Home() {
  const session = useSession();
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState('');

  useEffect(() => { if (session) syncPet().then(setState); }, [session]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  if (session === undefined) return null;
  if (!session || !isStudentEmail(session.user.email)) return <Navigate to="/" replace />;
  if (!state) return <main><p>Loading…</p></main>;
  if (!state.pet) return <Navigate to="/adopt" replace />;

  const p = state.pet;
  const fed = decayed(p.fed, new Date(p.statsAt), now);
  const joy = decayed(p.joy, new Date(p.statsAt), now);
  const s = state.streak!;

  async function devSpark() {
    // Temporary until Plan 3's Spark screen: proves the server loop end to end.
    try {
      const r = await completeSpark(state!.today);
      setNote(r.streakExtended ? `🔥 Streak ${r.streak}!` : 'Fed! 🍎');
      setState(await syncPet());
    } catch { setNote('No lesson content yet.'); }
  }

  return (
    <main>
      <h1>{p.name} the {p.species.replace('_', ' ')}</h1>
      <p>Mood: <b>{moodFor(fed, joy)}</b> · Stage: <b>{p.stage}</b> · Days tended: <b>{p.lifetimeDays}</b></p>
      <div className="card">
        <p>Fed</p><div className="bar"><span style={{ width: `${fed}%` }} /></div>
        <p>Joy</p><div className="bar"><span style={{ width: `${joy}%` }} /></div>
      </div>
      <div className="card">
        <h2>🔥 {s.current} day streak</h2>
        <p>Best: {s.best} · 🛡️ {s.shields}</p>
        {state.events?.shieldsUsed ? <p>Your shield protected your streak! 🛡️</p> : null}
        {state.events?.streakReset ? <p>New streak starting! Your best is {s.best} 🔥 Let's go!</p> : null}
      </div>
      <button onClick={devSpark}>Today's Spark (dev)</button>
      {note && <p>{note}</p>}
      <button className="secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );
}
```

- [ ] **Step 3: Write the teacher screens**

`src/screens/teacher/TeacherLogin.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export default function TeacherLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${location.origin}/teacher` },
    });
    if (error) setError(error.message); else setSent(true);
  }

  return (
    <main>
      <h1>Teacher sign in</h1>
      {sent ? <p>Check your email for a sign-in link ✉️</p> : (
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button>Send me a link</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  );
}
```

`src/screens/teacher/TeacherHome.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';

interface ClassRow { id: string; name: string; join_code: string; timezone: string }

export default function TeacherHome() {
  const session = useSession();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase.from('classes').select('id,name,join_code,timezone').order('created_at');
    setClasses(data ?? []);
  }

  useEffect(() => {
    if (!session) return;
    supabase.rpc('ensure_teacher').then(({ error }) => (error ? setError(error.message) : load()));
  }, [session]);

  if (session === undefined) return null;
  if (!session || isStudentEmail(session.user.email)) return <Navigate to="/teacher/login" replace />;

  async function create(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('create_class', { p_name: name });
    if (error) return setError(error.message);
    setName(''); load();
  }

  return (
    <main>
      <h1>Your classes</h1>
      {classes.map((c) => (
        <div className="card" key={c.id}>
          <h2>{c.name}</h2>
          <p>Join code: <b style={{ fontSize: '1.5rem', letterSpacing: 2 }}>{c.join_code}</b></p>
        </div>
      ))}
      <form onSubmit={create} className="card">
        <label>New class name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <button>Create class</button>
      </form>
      {error && <p className="error">{error}</p>}
      <button className="secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );
}
```

- [ ] **Step 4: Dev seed and launch config**

`supabase/seed.sql`:
```sql
-- DEV ONLY placeholder so the Spark loop can be exercised locally. Plan 3 replaces this file.
insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status, approved_at)
values (42, '2026-10-12', '2026-10-18', '[DEV PLACEHOLDER] Week 42', 'Isaiah 58–66',
        'https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/42?lang=eng',
        'placeholder', '{}'::jsonb, 'approved', now())
on conflict (id) do nothing;
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "tend", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

Run: `npx supabase db reset` (applies migrations + seed), `npx tsc --noEmit` (no errors), `npm test` (pass).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): bare student and teacher screens with routing"
```

---

### Task 9: PWA manifest, icons and install prompt

**Files:**
- Create: `public/icon.svg`, `pwa-assets.config.ts`, `src/install/platform.ts`, `src/install/platform.test.ts`, `src/install/InstallPrompt.tsx`
- Modify: `vite.config.ts`, `index.html`, `src/main.tsx`, `src/screens/Home.tsx`

**Interfaces:**
- Produces: `type InstallPlatform = 'installed'|'ios-safari'|'ios-other'|'in-app'|'android'|'other'`, `detectPlatform(ua: string, standalone: boolean, maxTouchPoints?: number): InstallPlatform`, `<InstallPrompt />` (self-contained, renders null when installed).

- [ ] **Step 1: Write the failing platform test**

`src/install/platform.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectPlatform } from './platform';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPHONE_INSTA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('detectPlatform', () => {
  it('installed wins', () => expect(detectPlatform(IPHONE_SAFARI, true)).toBe('installed'));
  it('iPhone Safari', () => expect(detectPlatform(IPHONE_SAFARI, false)).toBe('ios-safari'));
  it('iPhone Chrome', () => expect(detectPlatform(IPHONE_CHROME, false)).toBe('ios-other'));
  it('in-app browser', () => expect(detectPlatform(IPHONE_INSTA, false)).toBe('in-app'));
  it('iPad with desktop UA', () => expect(detectPlatform(IPAD_DESKTOP_UA, false, 5)).toBe('ios-safari'));
  it('Mac desktop is not iOS', () => expect(detectPlatform(IPAD_DESKTOP_UA, false, 0)).toBe('other'));
  it('Android', () => expect(detectPlatform(ANDROID, false)).toBe('android'));
  it('desktop', () => expect(detectPlatform(DESKTOP, false)).toBe('other'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, `./platform` not found.

- [ ] **Step 3: Implement `src/install/platform.ts`**

```ts
export type InstallPlatform = 'installed' | 'ios-safari' | 'ios-other' | 'in-app' | 'android' | 'other';

export function detectPlatform(ua: string, standalone: boolean, maxTouchPoints = 0): InstallPlatform {
  if (standalone) return 'installed';
  if (/Instagram|FBAN|FBAV|Snapchat|TikTok|musical_ly|Line\/|Twitter/i.test(ua)) return 'in-app';
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (iOS) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function currentPlatform(): InstallPlatform {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectPlatform(navigator.userAgent, standalone, navigator.maxTouchPoints);
}
```

Run: `npm test` → PASS.

- [ ] **Step 4: Icon, PWA plugin, early event capture**

`public/icon.svg` (sprout in a soft circle):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#7C5CFF"/>
  <circle cx="256" cy="300" r="150" fill="#FFF8EE"/>
  <path d="M256 380 V250" stroke="#3E8E41" stroke-width="22" stroke-linecap="round"/>
  <path d="M256 260 C 200 250 170 200 175 150 C 230 150 262 195 256 260 Z" fill="#5CBF60"/>
  <path d="M256 240 C 300 225 340 185 345 130 C 290 130 252 175 256 240 Z" fill="#7ED957"/>
</svg>
```

`pwa-assets.config.ts`:
```ts
import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({ preset, images: ['public/icon.svg'] });
```
Run: `npm run icons`
Expected: creates `public/pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`.

Replace `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Tend',
        short_name: 'Tend',
        description: 'Care for your pet with a daily spark from Come Follow Me.',
        theme_color: '#7C5CFF',
        background_color: '#FFF8EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { port: 5173, host: true },
  test: { env: loadEnv(mode === 'test' ? 'test' : mode, process.cwd(), '') },
}));
```

In `index.html` `<head>`, after the theme-color meta, add:
```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Tend" />
```

In `src/main.tsx`, before `createRoot(...)`, add:
```ts
// Chrome fires this once, often before React mounts. Keep it for InstallPrompt.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as Window & { __tendInstall?: Event }).__tendInstall = e;
  window.dispatchEvent(new Event('tend-installable'));
});
```

- [ ] **Step 5: Write `src/install/InstallPrompt.tsx` and mount it on Home**

```tsx
import { useEffect, useState } from 'react';
import { currentPlatform, type InstallPlatform } from './platform';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
const KEY = 'tend.installDismissed';
const getDeferred = () => (window as Window & { __tendInstall?: BeforeInstallPromptEvent }).__tendInstall;

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function writeDismissed() {
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode: just show it again next time */ }
}

export default function InstallPrompt() {
  const [platform] = useState<InstallPlatform>(currentPlatform);
  const [canPrompt, setCanPrompt] = useState(!!getDeferred());
  const [full, setFull] = useState(!readDismissed());

  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('tend-installable', on);
    return () => window.removeEventListener('tend-installable', on);
  }, []);

  if (platform === 'installed' || platform === 'other') return null;

  async function install() {
    const ev = getDeferred();
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
  }

  const steps = (() => {
    switch (platform) {
      case 'ios-safari':
        return <ol><li>Tap the <b>Share</b> button <span aria-hidden>⬆️</span> at the bottom of Safari</li><li>Scroll and tap <b>Add to Home Screen</b> ➕</li><li>Tap <b>Add</b></li></ol>;
      case 'ios-other':
        return <ol><li>Tap the <b>Share</b> button <span aria-hidden>⬆️</span></li><li>Tap <b>Add to Home Screen</b> ➕</li><li>Not there? Open this page in <b>Safari</b> and try again</li></ol>;
      case 'in-app':
        return <p>You're inside another app's browser. Tap the <b>⋯</b> menu and choose <b>Open in browser</b>, then add Tend to your home screen.</p>;
      case 'android':
        return canPrompt
          ? <button onClick={install}>Install Tend 📲</button>
          : <ol><li>Tap the <b>⋮</b> menu in Chrome</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b></li></ol>;
    }
  })();

  if (!full) {
    return (
      <div className="card" onClick={() => setFull(true)} role="button" style={{ cursor: 'pointer' }}>
        📲 <b>Put Tend on your home screen</b> so {`it's`} one tap away.
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(43,33,64,0.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <h2>Put Tend on your home screen 🏡</h2>
        <p>Your pet lives there. It opens like a real app, full screen.</p>
        {steps}
        <button className="secondary" onClick={() => { writeDismissed(); setFull(false); }}>Maybe later</button>
      </div>
    </div>
  );
}
```

In `src/screens/Home.tsx` add `import InstallPrompt from '../install/InstallPrompt';` and render `<InstallPrompt />` as the first child inside the returned `<main>`.

- [ ] **Step 6: Verify**

Run: `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (succeeds and emits `dist/manifest.webmanifest` and `dist/sw.js`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(pwa): manifest, icons and iOS/Android install prompt"
```

---

### Task 10: End-to-end check in a phone-sized browser

**Files:** none new (fixes go where defects are found).

- [ ] **Step 1: Full test sweep**

Run: `npx supabase db reset`, `npm run db:test`, `npm test`, `npm run test:int`
Expected: all pass.

- [ ] **Step 2: Drive the app**

Start the `tend` preview (launch.json), set the viewport to mobile, then:
1. `/teacher/login` → enter `teacher@example.com` → open Mailpit `http://127.0.0.1:54324` → click the link → lands on `/teacher` → create class "Test Class" → note the join code.
2. Sign out → `/join` → code, name "Sam", PIN 1234 twice → `/adopt` → otter, Pastel, "Ollie" → `/home` shows Ollie, Fed/Joy bars, 0-day streak, and the install card (iOS steps under the mobile UA).
3. Tap "Today's Spark (dev)" → "🔥 Streak 1!" and the streak card shows 1.
4. Sign out → `/login` with a wrong PIN shows the friendly error; with the right PIN it lands on `/home` with the streak still 1.
5. Check the console for errors (`read_console_messages`).

Expected: every step behaves as described with no console errors. Take a screenshot of `/home` as proof.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: issues found in end-to-end pass"
```
(Skip if nothing changed.)
