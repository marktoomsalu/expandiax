-- The experience network: places you want to go (your own, private list),
-- and how many travellers have been to a country and to each of its towns.
-- The counts are numbers only — never who — and leave out countries marked
-- "Only me", people who turned off "show me in search and suggestions",
-- and anyone blocked either way.

create table if not exists public.want_to_go (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  -- A town in that country, or '' for the country as a whole.
  place_name text not null default '' check (length(place_name) <= 80),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  constraint want_to_go_coords_ck check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180))
);
create unique index if not exists want_to_go_unique_idx on public.want_to_go (user_id, country_code, lower(place_name));

alter table public.want_to_go enable row level security;

drop policy if exists "want to go: own" on public.want_to_go;
create policy "want to go: own" on public.want_to_go for select using (user_id = auth.uid());
drop policy if exists "want to go: add own" on public.want_to_go;
create policy "want to go: add own" on public.want_to_go for insert with check (user_id = auth.uid());
drop policy if exists "want to go: remove own" on public.want_to_go;
create policy "want to go: remove own" on public.want_to_go for delete using (user_id = auth.uid());

-- Travellers who've been to a country (place = '') and to each of its towns.
create or replace function public.place_traveller_counts(p_country text)
returns table (place text, travellers bigint)
language sql stable security definer set search_path = public
as $$
  with seen as (
    select vc.id, vc.user_id
    from public.visited_countries vc
    join public.profiles p on p.id = vc.user_id
    where vc.country_code = upper(p_country)
      and vc.is_public
      and p.discoverable
      and (auth.uid() is null or not private.is_blocked_between(auth.uid(), vc.user_id))
  )
  select ''::text, count(distinct s.user_id) from seen s
  union all
  select min(trim(c.city_name)), count(distinct s.user_id)
  from seen s
  join public.country_cities c on c.visited_country_id = s.id
  group by lower(trim(c.city_name));
$$;

revoke all on function public.place_traveller_counts(text) from public;
grant execute on function public.place_traveller_counts(text) to anon, authenticated;
