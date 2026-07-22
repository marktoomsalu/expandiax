-- ============================================================
-- Move concert ratings from a 1-5 scale to 1-10. Existing ratings are
-- doubled so a previous "5" (best) still reads as "10" (best), not as a
-- mediocre 5/10. The old constraint is dropped first so a rating that was
-- already 5 (and becomes 10) isn't rejected mid-migration.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.concerts drop constraint concerts_rating_check;

update public.concerts set rating = rating * 2 where rating is not null;

alter table public.concerts add constraint concerts_rating_check check (rating between 1 and 10);
