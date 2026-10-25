# Tend — Daily Quiz, Talents and the Halloween Costume Shop

Date: 2026-10-11 · Status: approved in conversation, awaiting spec review · Branch: `quiz-talents`

## 1. Purpose

Give students a reason to actually read the week's scripture. An optional, open-book daily quiz on a short
passage earns **Talents 🪙**. Talents buy costumes for their pet, starting with a limited-time Halloween shop.

This deliberately changes one rule of the original design (`2026-10-11-tend-design.md` §9.2 "no tests or
quizzes"): Dillon decided an *optional* quiz is wanted. Everything else in that rule still holds — the quiz is
encouraging, never punishing:

- Optional. It never affects the streak, the pet's Fed/Joy/mood, or the Spark.
- No "wrong!", no red X, no scores shown to classmates. A miss shows the right answer and the verse it is in.
- Teachers see quiz *completion* and Talent totals, never individual answers.

Decisions made with Dillon (2026-10-11):

| Question | Decision |
|---|---|
| How often can Talents be earned from quizzes? | One quiz a day (that day's chapter), 5 questions, first try only; retakes are practice |
| How does reading work? | Open book: the passage (8–15 KJV verses) is shown in the app first and stays one tap away |
| Other Talent sources? | Quiz + streak milestone bonuses. Games never earn Talents |
| Costume form? | Mix-and-match head + body pieces, plus a few full costumes to save for |
| After Halloween? | Shop open Oct 12–31; owned items are kept and wearable forever |
| Who checks answers? | The server. Answers are never sent to the phone before grading |
| Currency name | Talents 🪙 (parable of the talents) |

## 2. The daily quiz

### 2.1 Student flow

1. Home shows **"📖 Today's Quiz · up to 50 🪙"** under the Spark and Play buttons. After the first attempt today
   it shows **"✓ Quiz done · +N 🪙"** and still opens (practice).
2. **Passage screen:** reference (e.g. *Isaiah 58:6–11*), the verses with verse numbers, button
   **"I've read it — start the quiz"**.
3. **Five questions**, one per screen, 3–4 choices each. A **"📖 Look back"** button reopens the passage.
4. **Feedback after each answer:** correct → "✅ +10" and a pet cheer; miss → the correct choice is shown and the
   verse containing it is highlighted ("It's in verse 6"). No negative wording.
5. **End screen:** "You earned 40 Talents! 🎃", new balance, **"Visit the shop"**. Practice runs say
   "Practice round — Talents count on your first try each day."

### 2.2 Rules

- A quiz belongs to one day of the current week (Mon = day 1 … Sun = day 7), matching that day's Spark.
- Only **today's** quiz can earn Talents (no catch-up earning); earlier days of the week can be practised.
- Talents are awarded once per student per day: the first submitted attempt for that date counts.
- A day with no quiz written shows no quiz button. Nothing else changes.

### 2.3 Content

Each day in `content/weeks/<N>.json` gains an optional `quiz`:

```jsonc
"quiz": {
  "ref": "Isaiah 58:6–11",
  "verses": [ { "n": 6, "text": "Is not this the fast that I have chosen? …" }, … ],   // exact KJV
  "questions": [
    { "q": "According to verse 7, who should you bring into your house?",
      "choices": ["the poor that are cast out", "the priests", "your neighbours' children", "the elders of the city"],
      "answer": 0, "verse": 7 }
  ]
}
```

- Questions are **literal** — the answer is stated in the passage. No interpretation or doctrine questions.
- Source rule unchanged: KJV text from churchofjesuschrist.org, chapters from that day's lesson section.
- `answer` and `verse` are **stripped from `weeks.content`** when loading and stored in a separate server-only
  table (§5). Students can read the questions but never the key.
- Every new week's quizzes are reviewed by Dillon in a deploy preview before the week is loaded.

## 3. Talents

### 3.1 Ledger

Every change is a row: `talent_ledger (student_id, amount, reason, ref, created_at)`. Balance = sum of rows.
Only server functions insert rows; students can read their own rows (balance + history).

### 3.2 Earning

| Event | Talents |
|---|---|
| Correct answer on today's quiz, first attempt | +10 each (max 50/day) |
| Streak reaches 3 / 7 / 14 / 21 / 30 / 50 / 75 / 100 | +20 / +50 / +75 / +100 / +150 / +200 / +250 / +300 |

Streak bonuses are paid by `complete_spark` at the same moment as the existing milestone celebration, each time
the streak reaches that number (a streak that resets and climbs again earns it again — it still takes real days).
The milestone toast adds "+50 Talents!".

### 3.3 Display

A 🪙 pill on Home beside the streak flame and shields; balance also on the quiz end screen and in the shop.

## 4. Halloween shop and costumes

### 4.1 Shop screen

New **🎃 Shop** button on Home → the student's pet large at the top (live try-on), banner
"🎃 Halloween shop closes in N days", then a grid of items:

- Not owned: price + **Buy**, or "N more Talents to go" when short.
- Owned: **Wear** / **Take off**.
- Tapping any item tries it on the preview pet without buying.
- After Oct 31: "The Halloween shop is closed — see you at Christmas!"; owned items remain wearable.

### 4.2 Items (server table `shop_items`)

| id | Slot | Name | Talents |
|---|---|---|---|
| hw_bat_ears | head | Bat ears | 80 |
| hw_cat_ears | head | Cat-ear headband | 80 |
| hw_witch_hat | head | Witch hat | 100 |
| hw_pumpkin_cap | head | Pumpkin cap | 100 |
| hw_wizard_hat | head | Wizard hat | 120 |
| hw_scarecrow_scarf | body | Scarecrow scarf | 90 |
| hw_hero_cape | body | Superhero cape | 130 |
| hw_vampire_cape | body | Vampire cape | 150 |
| hw_bat_wings | body | Bat wings | 150 |
| hw_ghost | full | Ghost sheet | 300 |
| hw_mummy | full | Mummy wraps | 300 |
| hw_pumpkin_suit | full | Pumpkin suit | 350 |

All share `available_from = 2026-10-12`, `available_to = 2026-10-31` (class time zone).
Family-friendly only: no devil horns, gore or scary faces.

### 4.3 Wearing

- `pets.equipped` (existing jsonb) holds `{ "head": id?, "body": id?, "full": id? }`.
- A full costume clears head and body; equipping head/body clears full.
- Only owned items can be equipped (server-checked).
- Ownership reuses the existing `unlocks` table (`item_id` = shop item id).

### 4.4 Drawing

Costume art is SVG drawn by the shared pet rig (`src/pet/Pet.tsx`) at fixed anchor points, so every item fits
all 15 species × 8 colours and every growth stage. Layers: body item behind/around the body, head item on top of
the head (above ears), full costume over the body with the pet's eyes (and face for the ghost) showing through.

Costumes appear everywhere the pet does: Home, Spark feed screen, all 8 games (sprite cache keyed by equipped
items), game-over, leaderboards, and the teacher roster (`leaderboard` and `class_roster` return `equipped`).

## 5. Data and server

New tables (RLS on; students never write directly):

- `quiz_keys (week_id, day, q_index, answer, verse)` — service role only.
- `quiz_attempts (student_id, date, week_id, day, correct, earned, created_at)`, PK `(student_id, date)` for the
  earning attempt; practice attempts are not stored.
- `talent_ledger (id, student_id, amount, reason, ref, created_at)` — student reads own rows.
- `shop_items (id, slot, name, price, available_from, available_to, sort)` — readable by all signed-in users.

New RPCs (security definer, `authenticated` only, inner `_fn` private, pgTAP-tested):

- `submit_quiz(p_date date, p_answers int[])` → per-question `{correct, answer, verse}` + `earned` + `balance`.
  Grades against `quiz_keys`; inserts `quiz_attempts` + ledger row only if `p_date` = today and no attempt exists
  for today; otherwise returns grading with `earned = 0` (practice). Rejects dates outside the current week.
- `buy_item(p_item text)` → `{balance}`; checks shop window (class time zone), not already owned, balance ≥ price;
  inserts `unlocks` + negative ledger row in one transaction. Errors: `shop_closed`, `already_owned`, `not_enough`.
- `equip_item(p_slot text, p_item text | null)` → checks ownership, applies the slot rules in §4.3.
- `sync_pet` additionally returns `talents` (balance), `quizDone` (today) and `equipped`.
- `_complete_spark` adds the streak-milestone ledger row (§3.2).
- `class_roster` adds `talents` and `quizzesWeek`; `leaderboard` and `class_roster` add `equipped`.

`scripts/load-content.mjs` splits each quiz: questions/choices/verses → `weeks.content`, answers → `quiz_keys`.

## 6. Error handling

- Offline / server error during quiz submit: keep answers on screen, "Couldn't save — try again", retry button.
  Grading is idempotent for the day (second submit becomes practice, never double-pays).
- Buying with a stale balance: server is the authority; the screen refreshes the balance after any error.
- Missing quiz or shop items: buttons simply don't render.

## 7. Testing

- pgTAP: grading, once-per-day earning, practice earns 0, other-day/other-week dates rejected, answers never
  readable by students, ledger balance math, streak bonuses at each milestone, buy (closed / owned / not enough /
  success is atomic), equip ownership + slot rules, roster/leaderboard fields.
- Vitest: quiz flow state (answers, look-back, end screen), content loader split, costume layer selection.
- Visual check: every costume on several species/colours/stages; preview link to Dillon before merge.

## 8. Rollout

1. Build on branch `quiz-talents`; PR → deploy preview `deploy-preview-<n>--ldstend.netlify.app`.
2. Database migrations are additive (new tables/columns/RPCs only), so the live app keeps working while the
   preview is tested. Quiz content for lesson 42 is loaded once Dillon has reviewed it in the preview.
3. Dillon tests on his phone, then says "launch" → merge to `master`.

Target: in students' hands by **Fri Oct 16** so there are two weekends of shop time before Oct 31.

## 9. Out of scope (this version)

Christmas shop, permanent basic shop, gifting/trading Talents, teacher-awarded Talents, quiz leaderboards,
quizzes for weeks other than the current one.
