-- ============================================================
-- Optional exact date per visit (year alone is still fine if that's all
-- you remember).
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.country_visits add column visited_on date;
