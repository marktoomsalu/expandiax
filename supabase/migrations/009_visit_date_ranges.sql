-- ============================================================
-- Replace the single visited_on date with a from/to range, so a multi-day
-- trip can be logged as a span instead of one point in time.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.country_visits add column visited_from date;
alter table public.country_visits add column visited_to date;

update public.country_visits set visited_from = visited_on where visited_on is not null;

alter table public.country_visits drop column visited_on;

alter table public.country_visits
  add constraint country_visits_range_order
  check (visited_to is null or visited_from is null or visited_to >= visited_from);
