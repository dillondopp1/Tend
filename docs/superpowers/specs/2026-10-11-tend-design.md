# Tend — Design Spec

**Date:** 2026-10-11
**Status:** Draft for review

## 1. Purpose

Tend is a Tamagotchi-style phone web app for a youth class (ages 14–18). Each student adopts a cartoon pet and keeps it happy by (a) reading a short daily "Spark" from that week's *Come Follow Me* lesson and (b) playing arcade-style games themed on the lesson.

**Success looks like:** students open the week's Come Follow Me material on most days of the week — not just Sunday — because they want to keep their pet happy and their streak alive. Learning must never feel like a chore or a test. Everything the app says to a student is positive and encouraging.

## 2. Users and roles

| Role | Signs in with | Can do |
|---|---|---|
| **Student** | Class code + display name + 4-digit PIN | Adopt/care for one pet, read Sparks, play games, write optional private reflections, see own streak and game leaderboards for their class |
| **Teacher** | Email magic link (Supabase Auth) | Create classes (get a join code), see a dashboard for their classes, reset a student's PIN, regenerate a class code |
| **Content admin** | Teacher account with `is_content_admin = true` (Dillon) | Review, edit and approve weekly lesson content |

Multiple teachers and classes are supported. All classes share the same weekly content.

## 3. Platform and stack

- **Front end:** React + TypeScript + Vite, built as a **Progressive Web App** (vite-plugin-pwa): web app manifest, icons, offline-cached shell, full-screen standalone display.
- **Back end:** Supabase (Postgres, Auth, Row Level Security, Edge Functions). **Development runs fully local** via the Supabase CLI (`npx supabase start`, Docker). All schema lives in `supabase/migrations/`, functions in `supabase/functions/`. At launch the same migrations/functions are pushed to Dillon's separate Supabase cloud project (`supabase link` + `db push` + `functions deploy`); the front end switches by env vars only.
- **Hosting:** Netlify.
- **Games:** HTML5 canvas, written in-house, no game engine dependency.
- **Art:** All pets, motifs and game sprites are hand-built SVG in the codebase. No licensed art.

### 3.1 Install-to-home-screen prompt

The app pushes installation as soon as a student has joined a class and adopted a pet:

- **Android / Chrome / Edge:** capture `beforeinstallprompt`, show a full-screen "Put Tend on your home screen" card with an **Install** button that fires the native prompt.
- **iPhone / iPad (Safari):** iOS does not let websites trigger an install prompt. Show a full-screen illustrated guide (animated arrow to the Share button → "Add to Home Screen" → "Add"). If the student is in an in-app browser (Instagram, Snapchat, etc.) or a non-Safari iOS browser, first tell them to open the link in Safari.
- **Already installed** (`display-mode: standalone` or `navigator.standalone`): never show the prompt.
- If dismissed, show a smaller banner on the home screen on each later visit until installed. Never block use of the app.

## 4. Authentication

### 4.1 Students (no email)

Two Edge Functions, using the service role key server-side only:

- **`student-join`** — input: class code, display name, PIN. Validates the class code, checks the display name is unique within the class, creates a Supabase Auth user with a synthetic, non-routable email (`<uuid>@students.tend.invalid`) and a random password nobody knows, stores a bcrypt hash of the PIN in `students`, then signs the student in (below).
- **`student-login`** — input: class code, display name, PIN. Looks up the student and verifies the PIN against the hash. On success it calls `auth.admin.generateLink({ type: 'magiclink' })` for the synthetic email and returns the `token_hash`; the client calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` to receive a normal session.
- **Lockout:** 5 wrong PINs → locked for 15 minutes (`failed_attempts`, `locked_until`). The error message stays friendly and never reveals whether the name exists.
- Sessions persist on the device, so students normally enter their PIN once.
- Teachers reset PINs through a third function, **`reset-student-pin`**, which checks that the caller teaches that student's class.

### 4.2 Teachers

Standard Supabase email magic-link sign-in. A teacher row is created on first sign-in. Dillon's row has `is_content_admin = true` (set manually in SQL).

## 5. Data model

All tables have RLS enabled. "Own" means `student_id = auth.uid()`.

| Table | Key columns | Who can read / write |
|---|---|---|
| `teachers` | `id` (= auth uid), `email`, `display_name`, `is_content_admin` | Self |
| `classes` | `id`, `teacher_id`, `name`, `join_code` (6 chars, unique), `timezone` (default `America/Denver`) | Teacher owns; students can read their own class |
| `students` | `id` (= auth uid), `class_id`, `display_name`, `pin_hash`, `failed_attempts`, `locked_until`, `created_at`, `last_active_at` | Own row (excluding `pin_hash`, via a view); teacher of the class reads; `pin_hash` is only touched by Edge Functions |
| `pets` | `student_id` (PK), `species`, `color_variant`, `name`, `fed`, `joy`, `stats_at`, `lifetime_days`, `equipped` (jsonb) | Own; teacher of the class reads |
| `streaks` | `student_id` (PK), `current`, `best`, `shields`, `last_tended_date` | Own reads; written only through RPC; teacher reads |
| `daily_activity` | `student_id`, `date`, `week_id`, `spark_section`, `spark_done_at`, `games_played`, `was_catch_up` | Own reads; written through RPC; teacher reads |
| `unlocks` | `student_id`, `item_id`, `unlocked_at` | Own; written through RPC |
| `reflections` | `id`, `student_id`, `date`, `week_id`, `body` | **Own only. Teachers and admins have no policy granting access.** |
| `weeks` | `id` (manual lesson number, e.g. 42), `start_date`, `end_date`, `title`, `scripture_block`, `manual_url`, `key_phrase`, `content` (jsonb, see §9), `status` (`draft`/`approved`), `approved_at` | Students read approved only; content admin reads and writes all |
| `game_scores` | `id`, `student_id`, `class_id`, `game`, `week_id`, `score`, `created_at` | Own insert (through RPC); class members read the leaderboard view |

Views and RPCs:
- `class_leaderboard(game, week_id)` returns the top 10 for the caller's class: display name, pet name, species, best score.
- `complete_spark(date, section)`, `record_game(game, score)` and `sync_pet()` are Postgres functions (`security definer`) that apply all stat, streak and unlock logic **on the server** so the client can't tamper with streaks.

## 6. Day, week and time rules

- A student's "day" is the calendar date in **their class's time zone**.
- A *Come Follow Me* week runs **Monday–Sunday**, matching the manual (e.g. lesson 42 = Oct 12–18).
- The current week is the approved `weeks` row whose date range contains today. If that week isn't approved yet, the app shows the most recent approved week. It is never empty.
- After lesson 52 (Christmas, Dec 21–27), Dec 28–31 keeps showing lesson 52 until 2027 content exists.

## 7. Pet

### 7.1 Species (15)

Fox, bunny, panda, cat, puppy, owl, penguin, axolotl, red panda, otter, frog, hedgehog, lamb, turtle, koala.

- All are cute, rounded, modern cartoon style, built on **one shared SVG rig** (body, head, eyes, mouth, accessory anchor points) with per-species parts (ears, tail, markings, palette).
- Shared animations: idle bounce, blink, eat, play, sleepy, celebrate, welcome-back.
- Each species has 3 color variants at the start; more unlock as rewards.

### 7.2 Stats and mood

- Two stats from 0–100: **Fed** (filled by the Spark) and **Joy** (filled by games).
- Both fall linearly from 100 to 0 over 72 hours. Stats are recalculated lazily from `stats_at` whenever the app opens; no cron job.
- Completing the Spark sets Fed to 100. Each finished game adds +25 Joy (capped at 100).
- Moods come from the lower of the two stats. **Thriving** ≥ 70, **Content** ≥ 40, **Sleepy** ≥ 15, **Misses you** < 15. There is no "dying" state and no sad or crying art. At its lowest the pet is curled up asleep with a little "zzz… I miss you!" bubble.
- Opening the app after 2 or more days away plays the **welcome-back** animation.

### 7.3 Growth

Growth depends on `lifetime_days` (days with a completed Spark), which only ever goes up:

| Stage | Lifetime days |
|---|---|
| Hatchling | 0 |
| Little | 3 |
| Young | 10 |
| Grown | 25 |
| Legendary | 50 |

Each stage is a visibly bigger, more detailed version of the same pet and gets a full-screen celebration.

## 8. Streaks (the core motivator)

- **A day counts when that day's Spark is finished on that day.** Games alone don't count, which keeps the streak tied to learning.
- **Streak shields:** a shield is earned every 7 consecutive days, holding up to 3. When the app syncs and finds missed days, it uses one shield per missed day (if enough shields are available) and the streak continues. The student sees "Your shield protected your streak! 🛡️".
- **If a streak breaks:** never show a negative message. Show "New streak starting — your best is N 🔥 Let's go!". `best` and `lifetime_days` never go down.
- **Milestones** at 3, 7, 14, 21, 30, 50, 75 and 100 days each get a full-screen confetti celebration plus a reward unlock: an accessory (hats, scarves, glasses, crown…), a home background, or a color variant.
- **Streaks are private competition-wise.** They appear only to the student and their teacher. There is no streak leaderboard anywhere.
- **Catch-up:** a student can complete any earlier Spark from the current week. It feeds the pet and adds to `lifetime_days`, but it doesn't extend or repair the streak.

## 9. Learning content

### 9.1 Source rule (strict)

All lesson content comes **only** from the 2026 manual *Come Follow Me—For Home and Church: Old Testament 2026* at `churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/<N>`, plus the scripture verses that each lesson page cites (also on churchofjesuschrist.org). No outside commentary, sources or invented doctrine.

- Scripture verses are quoted exactly (King James Version).
- Lesson ideas are summarised briefly, in teen-friendly wording, from the manual's own sections. Quotes from the manual are kept short, and every card links to the lesson page.
- The launch set is **lessons 42–52** (Oct 12 – Dec 27, 2026), 11 weeks in total.

| # | Dates | Block |
|---|---|---|
| 42 | Oct 12–18 | Isaiah 58–66 |
| 43 | Oct 19–25 | Jeremiah 1–3; 7; 16–18; 20 |
| 44 | Oct 26–Nov 1 | Jeremiah 31–33; 36–39; Lamentations 1; 3 |
| 45 | Nov 2–8 | Ezekiel 1–3; 33–34; 36–37; 47 |
| 46 | Nov 9–15 | Daniel 1–7 |
| 47 | Nov 16–22 | Hosea 1–6; 10–14; Joel |
| 48 | Nov 23–29 | Amos; Obadiah; Jonah |
| 49 | Nov 30–Dec 6 | Micah; Nahum; Habakkuk; Zephaniah |
| 50 | Dec 7–13 | Haggai 1–2; Zechariah 1–4; 7–14 |
| 51 | Dec 14–20 | Malachi |
| 52 | Dec 21–27 | Christmas |

### 9.2 The daily Spark — no tests

- 3–5 swipeable cards, styled like phone "stories", that take about a minute.
- Each day uses one section of the lesson (the manual's "Ideas for Learning" and "Ideas for Teaching Children" headings give roughly 8 sections a week, which spread across 7 days).
- **Card types:**
  - **Hook:** one surprising or relatable line that opens the idea.
  - **Verse:** the key verse, quoted, with the reference.
  - **What it means:** 1–3 short sentences drawn from the manual's section.
  - **Try this today:** one small, doable idea taken from the manual's activity suggestions.
- **No questions, quizzes, right or wrong answers, or scores.** Swiping to the last card shows "Feed [pet name] 🍎"; tapping it completes the Spark.
- **Optional, private reflection:** after feeding, a soft "Want to think about it more?" button opens a single text box. It is never required and never rewarded, and only the student can ever read it.

### 9.3 Week content JSON (`weeks.content`)

```jsonc
{
  "keyPhrase": "He hath borne our griefs",          // collected in games (§10)
  "keyPhraseRef": "Isaiah 53:4",
  "theme": { "palette": "dawn", "motifs": ["scroll","lamp","dove","olive"] },
  "sparks": [                                          // 7 entries, Mon..Sun
    { "day": 1, "section": "Isaiah 58", "manualAnchor": "...",
      "cards": [
        { "type": "hook", "text": "..." },
        { "type": "verse", "ref": "Isaiah 58:11", "text": "..." },
        { "type": "meaning", "text": "..." },
        { "type": "try", "text": "..." }
      ],
      "reflectPrompt": "..." }
  ],
  "gameSparks": [ "..." ],    // short one-liners shown on game-over screens
  "phraseMeaning": "..."      // shown when the key phrase is completed in a game
}
```

### 9.4 Content pipeline and review

1. Claude reads each manual page (and the scriptures it cites) and writes `content/weeks/<N>.json` in the repo.
2. `npm run seed:content` inserts any week **not already in the database**, with status `draft`. It never overwrites, so the database is the master copy after first import.
3. In the app, the content admin opens **Review** and sees the week exactly as a student would (Spark cards, game theme preview, key phrase). They can edit any text inline and then tap **Approve**.
4. Students only ever see approved weeks.

## 10. Games

Five games run on canvas at 60 fps and are tuned for a quick "one more try" loop. **The student's own pet is the player character** in every game.

| Game | Plays like | Core loop |
|---|---|---|
| **Glide** | Flappy Bird | Tap to flap through gaps; collect glowing words |
| **Dash** | Chrome dino runner | Tap to jump (hold for higher) over obstacles; speed ramps up |
| **Gather** | Candy Crush (match-3) | Swap tiles to match 3+; 60-second timed mode; combos and cascades |
| **Stack** | Stack tower | Tap to drop sliding blocks; overhang gets trimmed; build as high as possible |
| **Catch** | Falling catch | Slide to catch good items and dodge the rest; speed ramps up |

### 10.1 How lessons theme the games

- Each week's `theme` picks a **palette** and a set of **motifs** from a shared library of about 40 hand-drawn SVG motifs (scroll, lamp, dove, olive branch, stone, wall brick, fish, wave, lion, star, crown, harp, wheat, vine, trumpet…). Motifs become obstacles, tiles, falling items, Stack blocks and background art, so every week looks different.
- **The key phrase:** the words of the week's key phrase appear as collectibles in Glide, Dash and Catch, become special tiles in Gather, and appear on milestone blocks in Stack. Collecting every word in one run plays a "Phrase complete!" moment with a bonus, and shows `phraseMeaning` with the verse reference.
- **Game-over screen:** shows score, personal best, a "Play again" button and one `gameSparks` line from the week. It never just says "Game Over".

### 10.2 Rewards and competition

- Every finished run adds +25 Joy to the pet. Play is unlimited.
- **Competition is on game scores only.** Each game has a **weekly class leaderboard** (top 10, display name + pet) that resets every Monday with the new lesson, so new players always have a shot. Personal bests are shown too.
- Basic sanity checks reject impossible scores (each game has a maximum plausible score per second of play).

## 11. Teacher dashboard

- A list of classes, each with its join code (copy/share button, and a regenerate option).
- **Roster:** for each student, their pet (species and current mood), last active, current streak, best streak, Sparks done this week (e.g. 4/7) and games played this week.
- **Class at a glance:** how many students did today's Spark and the week's totals.
- **Reset PIN** for a student.
- Reflections are **never** visible to teachers.

## 12. Screens

**Student:**
1. **Welcome:** join a class, or sign back in.
2. **Join:** class code → name → PIN (twice).
3. **Adopt:** a 15-animal picker → color → name → egg hatch.
4. **Install** card/guide (§3.1).
5. **Home:**
   - the pet, mood, Fed and Joy bars, and the big streak flame with shield count
   - a "Today's Spark" button and a "Play" button
   - the growth stage
6. **Spark** (story cards) → feed animation → optional reflection.
7. **Play:** a picker of the 5 games, with this week's theme preview and personal bests → game → game over → leaderboard.
8. **Closet:** unlocked accessories, backgrounds and colors to equip.
9. **This week:** all 7 days' Sparks with catch-up access.

**Teacher:** sign in → classes → class dashboard → student detail / reset PIN.

**Admin:** Review → week list (draft or approved) → week preview and edit → Approve.

## 13. Testing

- **Unit tests (Vitest):** stat decay and mood thresholds, growth stages, streak and shield logic (including multi-day gaps, shields exactly covering a gap, and catch-up not extending streaks), day and week resolution across time zones and DST, the current-week fallback, and score sanity limits.
- **Database tests:** run against the Supabase project. They check that RLS isolates classes, that teachers can't read reflections, that students can't read `pin_hash`, can't write streaks directly, and can't read draft weeks.
- **Edge Function tests:** join (duplicate name rejected), login (wrong PIN, lockout after 5, unlock after 15 min), and teacher PIN reset (only for their own class).
- **Content validation:** a script checks every `content/weeks/*.json` against the schema: 7 sparks, card types, verse refs present, and key-phrase words that fit the games.
- **Manual end-to-end pass** in a phone-sized browser: join → adopt → install prompt → Spark → each game → leaderboard → teacher dashboard → admin approve.

## 14. Out of scope for v1 / open items

- **Push notification reminders:** a strong follow-up, but not v1.
- **2027 content:** a new manual year. Decide in December.
- **Supabase cloud account (needed at launch only):** the Supabase connector is signed into the `tetonvault` account; nothing for Tend is created there. At launch, link the CLI to Dillon's new project (service role key stays in Edge Function secrets, never the front end).
- **Domain:** a Netlify subdomain for now; a custom domain is optional later.
