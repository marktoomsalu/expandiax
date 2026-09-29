-- "Interested" in an upcoming event (the ♥ on an event card): what it is,
-- when and where, and a link to its tickets — so the people who can see your
-- profile see which events you're into, and Explore can show "4 friends
-- interested". The same visibility as the rest of your profile applies.

create table if not exists public.event_interest (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The listing's id at its source ("tm-…", "fienta-…"), so the same event is recognised.
  event_key text not null check (length(event_key) between 1 and 200),
  name text not null check (length(trim(name)) between 1 and 200),
  event_date date not null,
  venue text not null default '' check (length(venue) <= 200),
  city text not null default '' check (length(city) <= 100),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  category text not null default 'other' check (category in ('music', 'festival', 'sport', 'conference', 'arts', 'other')),
  url text check (url is null or (url ~ '^https://' and length(url) <= 1000)),
  image text check (image is null or (image ~ '^https://' and length(image) <= 1000)),
  created_at timestamptz not null default now(),
  primary key (user_id, event_key)
);
create index if not exists event_interest_key_idx on public.event_interest (event_key);
create index if not exists event_interest_date_idx on public.event_interest (event_date);

alter table public.event_interest enable row level security;

drop policy if exists "event interest readable" on public.event_interest;
create policy "event interest readable" on public.event_interest for select
  using (user_id = auth.uid() or public.is_profile_public(user_id));
drop policy if exists "event interest: add own" on public.event_interest;
create policy "event interest: add own" on public.event_interest for insert with check (user_id = auth.uid());
drop policy if exists "event interest: remove own" on public.event_interest;
create policy "event interest: remove own" on public.event_interest for delete using (user_id = auth.uid());
