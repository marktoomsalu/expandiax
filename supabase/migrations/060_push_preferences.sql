-- ============================================================
-- Push notifications, category by category (Settings → Notification
-- settings → Push notifications). All on by default; /api/push/send
-- checks them before sending.
--
--   push_followers  new followers, follow requests, requests accepted
--   push_messages   questions and answers about places
--   push_activity   likes and comments on your posts
--   push_reminders  reminders to add photos and memories
--   push_updates    greetings, memories from the past, what's new
-- ============================================================

alter table public.profiles
  add column if not exists push_followers boolean not null default true,
  add column if not exists push_messages boolean not null default true,
  add column if not exists push_activity boolean not null default true,
  add column if not exists push_reminders boolean not null default true,
  add column if not exists push_updates boolean not null default true;
