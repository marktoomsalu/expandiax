-- ============================================================
-- Per-photo focal point, so a cover crop can be repositioned instead of
-- always defaulting to a fixed top/center bias.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.country_media
  add column focal_x smallint check (focal_x between 0 and 100),
  add column focal_y smallint check (focal_y between 0 and 100);

alter table public.event_media
  add column focal_x smallint check (focal_x between 0 and 100),
  add column focal_y smallint check (focal_y between 0 and 100);
