-- ============================================================
-- Move concert ratings from a 1-5 scale to 1-10. Existing ratings are
-- doubled first so a previous "5" (best) still reads as "10" (best), not
-- as a mediocre 5/10.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

update public.concerts set rating = rating * 2 where rating is not null;

alter table public.concerts drop constraint concerts_rating_check;
alter table public.concerts add constraint concerts_rating_check check (rating between 1 and 10);
