-- Dream events: artists, festivals, races and events you dream of going to —
-- your own, private list, like your dream places (the want_to_go table).

create table if not exists public.dream_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  event_type text not null default 'concert'
    check (event_type in ('concert', 'festival', 'sport', 'conference', 'personal', 'other')),
  image text check (image is null or (image ~ '^https://' and length(image) <= 500)),
  created_at timestamptz not null default now()
);
create unique index if not exists dream_events_unique_idx on public.dream_events (user_id, lower(trim(name)));

alter table public.dream_events enable row level security;

drop policy if exists "dream events: own" on public.dream_events;
create policy "dream events: own" on public.dream_events for select using (user_id = auth.uid());
drop policy if exists "dream events: add own" on public.dream_events;
create policy "dream events: add own" on public.dream_events for insert with check (user_id = auth.uid());
drop policy if exists "dream events: remove own" on public.dream_events;
create policy "dream events: remove own" on public.dream_events for delete using (user_id = auth.uid());
