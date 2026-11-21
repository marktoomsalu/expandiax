-- ============================================================
-- Our own catalogue of real events, so "Find my world" and adding an
-- event can recognise more than concerts: football matches, festivals,
-- races and conferences, since 2019, each with a date and a place.
--
-- 1. event_catalog: filled monthly from open sources (openfootball, CC0;
--    Wikidata, CC0; confs.tech, MIT) by /api/cron/event-catalog. Readable
--    by anyone (it's public knowledge); written only by the server.
--    kind 'race_series': a race that comes back every year at the same
--    place (IRONMAN Estonia), with no date of its own.
-- 2. member_events(): events members saved that 2 or more of them share
--    (same name, day and country, shown to everyone). Only the event and
--    how many: never who.
-- ============================================================

create extension if not exists pg_trgm;

create table if not exists public.event_catalog (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('football', 'festival', 'race', 'race_series', 'conference')),
  title text not null check (length(title) between 1 and 200),
  starts_on date,
  ends_on date,
  venue text,
  city text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  lat double precision,
  lng double precision,
  source text not null,
  source_id text not null,
  url text,
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists event_catalog_day on public.event_catalog (starts_on, country_code);
create index if not exists event_catalog_series on public.event_catalog (country_code) where kind = 'race_series';
create index if not exists event_catalog_title on public.event_catalog using gin (title gin_trgm_ops);

alter table public.event_catalog enable row level security;
drop policy if exists "event_catalog is public" on public.event_catalog;
create policy "event_catalog is public" on public.event_catalog for select using (true);

create or replace function public.member_events(p_from date, p_to date, p_country text default null, p_q text default null)
returns table (title text, event_type text, event_date date, venue text, city text, country_code text, members int)
language sql stable security definer set search_path = public
as $$
  select
    min(e.title) as title,
    mode() within group (order by e.event_type) as event_type,
    e.event_date,
    mode() within group (order by nullif(e.venue, '')) as venue,
    mode() within group (order by nullif(e.city, '')) as city,
    e.country_code,
    count(distinct e.user_id)::int as members
  from public.events e
  where e.event_date between p_from and p_to
    and (p_country is null or e.country_code = p_country)
    and e.audience = 'everyone'
    and e.event_type in ('concert', 'festival', 'sport', 'conference', 'other')
    and (p_q is null or e.title ilike '%' || p_q || '%')
  group by lower(regexp_replace(trim(e.title), '\s+', ' ', 'g')), e.event_date, e.country_code
  having count(distinct e.user_id) >= 2
  order by e.event_date desc
  limit 50;
$$;

revoke all on function public.member_events(date, date, text, text) from public;
grant execute on function public.member_events(date, date, text, text) to anon, authenticated, service_role;
