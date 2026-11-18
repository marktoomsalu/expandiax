-- 081: who uses the iPhone and Android apps, and whether notifications are on.
--
-- The dashboard only knew phones that had allowed notifications (3 iPhones),
-- not how many people use the app at all, so it couldn't tell a good yes-rate
-- from a bad one. The app now notes, at most once a day per person and
-- platform: that it was opened, its version, and whether notifications are
-- on ("granted"), refused ("denied") or not asked yet ("prompt"). Nothing
-- else: no device ids, no location.

create table if not exists public.app_devices (
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  notifications text not null default 'prompt' check (notifications in ('granted', 'denied', 'prompt')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, platform)
);

alter table public.app_devices enable row level security;

-- People note their own; the dashboard reads with the service role.
drop policy if exists "app devices: your own" on public.app_devices;
create policy "app devices: your own" on public.app_devices for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.app_devices to authenticated;
