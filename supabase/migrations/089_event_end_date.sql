-- ============================================================
-- Events that last more than a day: a festival weekend, a conference, a
-- tournament. event_date stays the first day (everything that sorts, groups
-- or matches by date keeps working); end_date is the last day, or null for
-- a one-day event (most concerts).
-- ============================================================

alter table public.events
  add column if not exists end_date date;

alter table public.events
  drop constraint if exists events_end_after_start;

alter table public.events
  add constraint events_end_after_start check (end_date is null or end_date >= event_date);
