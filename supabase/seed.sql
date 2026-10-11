-- DEV ONLY placeholder so the Spark loop can be exercised before real content exists.
-- Applied to the cloud project by hand: npx supabase db query --linked -f supabase/seed.sql
-- Plan 3 must DELETE week 42 before loading real content (seed:content never overwrites).
insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status, approved_at)
values (42, '2026-10-12', '2026-10-18', '[DEV PLACEHOLDER] Week 42', 'Isaiah 58–66',
        'https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/42?lang=eng',
        'placeholder', '{}'::jsonb, 'approved', now())
on conflict (id) do nothing;
