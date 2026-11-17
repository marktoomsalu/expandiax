-- 077: events you don't mean to add photos to. The × on the Events page's
-- "waiting for your memories" list sets this, so the event leaves the list
-- on every device (the same as countries' photo_reminder_off, 076).

alter table public.events
  add column if not exists memory_reminder_off boolean not null default false;
