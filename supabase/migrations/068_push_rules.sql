-- ============================================================
-- Smarter push notifications (lib/pushPolicy.ts).
--
--   push_log       every push decision for a person: sent, sent silently
--                  (quiet hours), updated in place (grouped: "Alex and 4
--                  others liked your memory") or skipped (and why). Used
--                  to group, to space out reminders and announcements,
--                  and for the stats in /admin/push. Kept 90 days.
--   push_rules     the numbers behind it (quiet hours, how often…), set in
--                  /admin/push; the app's defaults apply to anything unset.
--   push_presence  whether someone has the app open right now, and on
--                  which chat / notifications / post, so they aren't
--                  buzzed about what they're looking at. One row each,
--                  overwritten every 20 seconds while open.
--   device_tokens.timezone   for quiet hours and evening reminders.
--   push_deliveries.sent_at  may be empty: an announcement waiting for
--                  someone's morning (push_campaigns.waiting counts them).
-- Also: new words for the grouped and reminder notifications, and
-- "Remembered" becomes "Like".
-- ============================================================

create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  priority smallint not null,
  group_key text,
  -- The notification, message or announcement it's about.
  ref_id uuid,
  -- A reminder's memory ("country:<id>"), so the next one picks another.
  target text,
  outcome text not null check (outcome in ('sent', 'silent', 'updated', 'skipped')),
  reason text,
  title text,
  body text,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);
create index if not exists push_log_user_idx on public.push_log (user_id, created_at desc);
create index if not exists push_log_group_idx on public.push_log (user_id, group_key, created_at desc);
create index if not exists push_log_created_idx on public.push_log (created_at);
alter table public.push_log enable row level security;

create table if not exists public.push_rules (
  id boolean primary key default true check (id),
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.push_rules (id) values (true) on conflict do nothing;
alter table public.push_rules enable row level security;

create table if not exists public.push_presence (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now(),
  left_at timestamptz,
  screen text check (screen is null or length(screen) <= 200),
  conversation_id uuid
);
alter table public.push_presence enable row level security;
drop policy if exists "presence: own row" on public.push_presence;
create policy "presence: own row" on public.push_presence for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update on public.push_presence to authenticated;

alter table public.device_tokens
  add column if not exists timezone text check (timezone is null or length(timezone) <= 64);

alter table public.push_deliveries alter column sent_at drop not null;
alter table public.push_campaigns add column if not exists waiting int not null default 0;

-- The words: the old defaults move to the new ones (anything already
-- changed in the admin panel is left alone)…
update public.push_templates set body = '{name} liked your memory ❤️' where kind = 'like' and body = '{name} liked your {thing}';
update public.push_templates set body = '{name} started following you!' where kind = 'follow' and body = '{name} started following you';
update public.push_templates set body = '{name} commented on your memory' where kind = 'comment' and body = '{name} commented: "{text}"';
update public.push_templates set title = 'New message', body = '{name} sent you a message.' where kind = 'message' and title = '{name}' and body = '{text}';

-- …and the grouped ones and memory reminders join them.
insert into public.push_templates (kind, title, body) values
  ('like_many', 'New likes', '{name} and {others} liked your memory ❤️'),
  ('follow_many', 'New followers', '{name} and {others} started following you!'),
  ('follow_request_many', 'Follow requests', '{name} and {others} want to follow you'),
  ('comment_many', 'New comments', '{count} people commented on your memory'),
  ('answer_many', 'New answers', '{count} people answered your question'),
  ('message_many', 'New messages', '{name} sent you {count} messages.'),
  ('reminder_anniversary', '{ago} today', '{title} {flag}. Take a moment to look back.'),
  ('reminder_photos', 'Your {title} memories', 'No photos from {title} yet. Add a few so it''s never forgotten.'),
  ('reminder_memory', 'One to remember', '{title} {flag}, {ago}. Take a look back ✨')
on conflict (kind) do nothing;
