-- ============================================================
-- Let each visit to a country have its own highlight, and allow logging
-- more than one visit in the same year.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.country_visits
  add column highlight text not null default '' check (length(highlight) <= 500);

alter table public.country_visits
  drop constraint country_visits_visited_country_id_year_key;
