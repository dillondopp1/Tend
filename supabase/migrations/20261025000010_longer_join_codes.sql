-- Class codes may be 4-12 letters/numbers (was exactly 6) so a class can have a word like STONEHAVEN.
-- Only relaxes the rule: every existing 6-character code stays valid, and generated codes are still 6 characters.
alter table public.classes drop constraint classes_join_code_check;
alter table public.classes add constraint classes_join_code_check check (join_code ~ '^[A-Z0-9]{4,12}$');
