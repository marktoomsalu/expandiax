-- ============================================================
-- Push notifications from the admin panel (/admin/push).
--
--   push_campaigns   announcements written in the admin panel: sent now or
--                    at a set time, to everyone who allows that kind of
--                    notification (narrowed by phone, home country or how
--                    recently they used the app), with their results.
--   push_deliveries  who got which campaign and whether they opened it;
--                    also keeps anyone from getting more than one a day.
--   push_templates   the words of the automatic notifications (new
--                    follower, like, comment, message…) and an on/off
--                    switch for each, read by /api/push/send.
-- Only the server reads or writes these (no policies). Melody becomes an
-- admin. Scheduled campaigns go out within five minutes of their time
-- (pg_cron calls /api/cron/push-campaigns).
-- ============================================================

insert into public.admins (user_id)
select id from public.profiles where username = 'melodynirk'
on conflict do nothing;

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  body text not null check (length(trim(body)) between 1 and 300),
  -- Where tapping it opens: a page of the app.
  link text not null default '/feed' check (link ~ '^/' and length(link) <= 200),
  -- Which Settings switch it answers to.
  category text not null default 'push_updates' check (category in ('push_updates', 'push_reminders')),
  -- Narrowing: { "platform": "ios" | "android", "country": "EE", "activeDays": 30 }.
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  recipients int not null default 0,
  delivered int not null default 0,
  failed int not null default 0,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists push_campaigns_due_idx on public.push_campaigns (status, send_at);

create table if not exists public.push_deliveries (
  campaign_id uuid not null references public.push_campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  primary key (campaign_id, user_id)
);
create index if not exists push_deliveries_user_idx on public.push_deliveries (user_id, sent_at desc);

create table if not exists public.push_templates (
  kind text primary key,
  title text not null check (length(trim(title)) between 1 and 80),
  body text not null check (length(trim(body)) between 1 and 300),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- The words the app uses today. {name} is who did it, {thing} trip or
-- event, {place} the country, {text} their comment, question or message.
insert into public.push_templates (kind, title, body) values
  ('follow', 'New follower', '{name} started following you'),
  ('follow_request', 'Follow request', '{name} wants to follow you'),
  ('follow_accepted', 'Follow request accepted', '{name} accepted your follow request'),
  ('like', 'New like', '{name} liked your {thing}'),
  ('comment', 'New comment', '{name} commented: "{text}"'),
  ('question', 'A question for you', '{name} asks about {place}: "{text}"'),
  ('answer', 'New answer', '{name} answered: "{text}"'),
  ('message', '{name}', '{text}'),
  ('postcard', 'A postcard for you', '{name}: "{text}"')
on conflict (kind) do nothing;

alter table public.push_campaigns enable row level security;
alter table public.push_deliveries enable row level security;
alter table public.push_templates enable row level security;

-- Every five minutes, send what's due (if pg_cron can be turned on here;
-- otherwise the admin page and a daily check send them).
do $outer$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'expandiax-push-campaigns';
  perform cron.schedule(
    'expandiax-push-campaigns',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://expandiax.com/api/cron/push-campaigns',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || substring(pg_get_functiondef('public.trigger_notify_push'::regproc) from 'Bearer ([^'']+)''')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron is not available (%); scheduled pushes go out from the admin page and the daily check.', sqlerrm;
end;
$outer$;
