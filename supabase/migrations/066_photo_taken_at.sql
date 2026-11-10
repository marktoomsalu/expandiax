-- When each photo was taken (from its EXIF, read on the phone before the
-- photo is stripped for upload), so a trip's or event's photos can be kept
-- in time order: new photos slot in by when they were taken, and
-- anything arranged by hand stays as it is.
alter table public.country_media add column if not exists taken_at timestamptz;
alter table public.event_media add column if not exists taken_at timestamptz;
