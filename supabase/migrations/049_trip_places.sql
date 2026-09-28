-- Trips get a title and a type (a trip, or somewhere you lived); the cities
-- of a trip become places with their own dates, order in the journey and a
-- position on the map; and a photo can belong to one of the trip's places.
-- Everything existing stays as it is — the new fields start empty.

-- 1. Trips: a title ("Slovenia Road Trip") and a type.
alter table public.country_visits
  add column if not exists title text not null default '',
  add column if not exists kind text not null default 'trip';

do $$ begin
  alter table public.country_visits add constraint country_visits_title_len check (length(title) <= 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.country_visits add constraint country_visits_kind_ck check (kind in ('trip', 'lived'));
exception when duplicate_object then null; end $$;

-- 2. Places in a trip: dates, order, map position.
alter table public.country_cities
  add column if not exists arrived date,
  add column if not exists departed date,
  add column if not exists position int not null default 0,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

do $$ begin
  alter table public.country_cities add constraint country_cities_dates_ck check (departed is null or arrived is null or departed >= arrived);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.country_cities add constraint country_cities_coords_ck
    check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180));
exception when duplicate_object then null; end $$;

-- Existing places get an order (alphabetical within each trip, for now).
update public.country_cities c set position = o.n
from (select id, row_number() over (partition by country_visit_id order by city_name) - 1 as n from public.country_cities) o
where c.id = o.id and c.position = 0;

-- Places could be added and removed but not edited — now they can be.
drop policy if exists "country cities update" on public.country_cities;
create policy "country cities update" on public.country_cities for update
  using (public.owns_visited_country(visited_country_id))
  with check (public.owns_visited_country(visited_country_id));

-- 3. A photo can belong to one of its trip's places.
alter table public.country_media
  add column if not exists city_id uuid references public.country_cities (id) on delete set null;
create index if not exists country_media_city_idx on public.country_media (city_id);

-- …and only a place in the same trip.
create or replace function public.country_media_city_same_trip()
returns trigger
language plpgsql
as $$
begin
  if new.city_id is not null and not exists (
    select 1 from public.country_cities c
    where c.id = new.city_id and c.country_visit_id = new.country_visit_id
  ) then
    raise exception 'That place is not part of this trip';
  end if;
  return new;
end;
$$;

drop trigger if exists country_media_city_same_trip on public.country_media;
create trigger country_media_city_same_trip
  before insert or update of city_id, country_visit_id on public.country_media
  for each row execute function public.country_media_city_same_trip();
