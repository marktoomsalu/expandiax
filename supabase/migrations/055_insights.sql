-- ============================================================
-- Privacy-friendly numbers for the founder's dashboard (/admin).
--
-- activity_days: one row per member per day they used ExpandiaX — the
-- day only, never what they looked at — so "active members" and "do people
-- come back" can be counted. Recorded server-side when a signed-in session
-- renews (no cookies or device storage for it), readable by nobody but the
-- server, and deleted after 13 months (the weekly job prunes it).
--
-- admins: who may open /admin. No policies at all, so only the server
-- (service role) can read it; add yourself with the insert at the bottom.
-- ============================================================

create table if not exists public.activity_days (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  primary key (user_id, day)
);
create index if not exists activity_days_day_idx on public.activity_days (day);

alter table public.activity_days enable row level security;

-- Members can record their own day (and nothing else); nobody can read it back.
drop policy if exists "activity: record own day" on public.activity_days;
create policy "activity: record own day" on public.activity_days for insert
  with check (user_id = auth.uid() and day between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1);
grant insert on public.activity_days to authenticated;

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- (No policies: invisible to everyone except the server.)

-- Make yourself the admin: replace the email with the one you sign in to ExpandiaX with.
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;
