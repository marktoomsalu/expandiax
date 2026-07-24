-- ============================================================
-- Per-trip details: each individual visit to a country (not just the
-- country as a whole) can now carry its own photos, its own Spotify
-- soundtrack, and a proper memory (highlight, given more room). Two
-- trips to the same country — a concert, then a holiday — stop
-- sharing one pool of photos/one song/one note.
--
-- The country-level note and general photo gallery are untouched; the
-- country-level soundtrack is superseded by per-visit and is migrated
-- onto each country's most recent visit before being dropped.
-- ============================================================

-- ---------- country_visits: soundtrack + a real memory ----------

alter table public.country_visits
  add column spotify_track_id text,
  add column spotify_track_name text,
  add column spotify_track_artist text,
  add column spotify_track_image text;

alter table public.country_visits
  drop constraint country_visits_highlight_check,
  add constraint country_visits_highlight_check check (length(highlight) <= 1000);

-- Was missing entirely — a visit's highlight/soundtrack could never be
-- edited after creation, only deleted and re-added.
create policy "country visits update" on public.country_visits for update
  using (public.owns_visited_country(visited_country_id))
  with check (public.owns_visited_country(visited_country_id));

-- ---------- country_media: optionally scoped to one visit ----------

alter table public.country_media
  add column country_visit_id uuid references public.country_visits (id) on delete cascade;

create index country_media_visit_idx on public.country_media (country_visit_id, display_order);

-- Each visit (or the general, untagged pool) now gets its own 5-photo
-- cap, instead of every trip to a country sharing one pool of 5 total.
create or replace function public.enforce_country_media_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.country_media
      where visited_country_id = new.visited_country_id
      and country_visit_id is not distinct from new.country_visit_id) >= 5 then
    raise exception 'A trip can have at most 5 photos.';
  end if;
  return new;
end;
$$;

-- ---------- migrate the country-level soundtrack onto the most recent visit ----------

-- A country can have a soundtrack set with zero dated visits logged (the
-- soundtrack picker never required one) — give those a placeholder visit
-- first so the value has somewhere to land instead of being silently
-- dropped by the column removal below.
insert into public.country_visits (visited_country_id, year, date_precision, spotify_track_id, spotify_track_name, spotify_track_artist, spotify_track_image)
select vc.id, extract(year from now())::int, 'year', vc.spotify_track_id, vc.spotify_track_name, vc.spotify_track_artist, vc.spotify_track_image
from public.visited_countries vc
where vc.spotify_track_id is not null
  and not exists (select 1 from public.country_visits where visited_country_id = vc.id);

with latest_visit as (
  select distinct on (visited_country_id) id, visited_country_id
  from public.country_visits
  order by visited_country_id, coalesce(visited_to, visited_from, make_date(year, 12, 31)) desc
)
update public.country_visits cv
set
  spotify_track_id = vc.spotify_track_id,
  spotify_track_name = vc.spotify_track_name,
  spotify_track_artist = vc.spotify_track_artist,
  spotify_track_image = vc.spotify_track_image
from public.visited_countries vc
join latest_visit lv on lv.visited_country_id = vc.id
where cv.id = lv.id and vc.spotify_track_id is not null;

-- Drop the view before dropping the columns below — it still references
-- vc.spotify_track_id at this point, and Postgres won't let a column be
-- dropped while a view depends on it. Rebuilt against the new locations
-- immediately after.
drop view if exists public.feed_events;

alter table public.visited_countries
  drop column spotify_track_id,
  drop column spotify_track_name,
  drop column spotify_track_artist,
  drop column spotify_track_image;

-- ---------- feed_events: country branch pulls soundtrack from the same "most recent visit" lateral already used for its date ----------

create view public.feed_events
with (security_invoker = true) as
  select
    'country'::text as kind,
    null::text as event_type,
    vc.id as ref_id,
    vc.user_id as actor_id,
    vc.country_code as country_code,
    vc.country_name as country_name,
    vc.country_name as title,
    null::text as subtitle,
    nullif(vc.note, '') as body,
    null::text as venue,
    null::text as city,
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    lv.year as visit_year,
    coalesce(lv.visited_to, lv.visited_from) as visit_date,
    lv.date_precision as visit_date_precision,
    lv.spotify_track_id as spotify_track_id,
    lv.spotify_track_name as spotify_track_name,
    lv.spotify_track_artist as spotify_track_artist,
    vc.created_at as created_at
  from public.visited_countries vc
  left join lateral (
    select public_url, media_type
    from public.country_media
    where visited_country_id = vc.id
    order by (id = vc.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
  left join lateral (
    select year, visited_from, visited_to, date_precision, spotify_track_id, spotify_track_name, spotify_track_artist
    from public.country_visits
    where visited_country_id = vc.id
    order by coalesce(visited_to, visited_from, make_date(year, 12, 31)) desc
    limit 1
  ) lv on true
  where vc.share_to_feed
  union all
  select
    'event'::text as kind,
    e.event_type as event_type,
    e.id as ref_id,
    e.user_id as actor_id,
    e.country_code as country_code,
    e.country_name as country_name,
    e.title as title,
    nullif(e.subtitle, '') as subtitle,
    nullif(e.review, '') as body,
    nullif(e.venue, '') as venue,
    nullif(e.city, '') as city,
    coalesce(cm.public_url, e.spotify_artist_image) as cover_url,
    coalesce(cm.media_type, case when e.spotify_artist_image is not null then 'image' end) as cover_media_type,
    extract(year from e.event_date)::int as visit_year,
    e.event_date as visit_date,
    'day'::text as visit_date_precision,
    null::text as spotify_track_id,
    null::text as spotify_track_name,
    null::text as spotify_track_artist,
    e.created_at as created_at
  from public.events e
  left join lateral (
    select public_url, media_type
    from public.event_media
    where event_id = e.id
    order by (id = e.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
  where e.is_public and e.share_to_feed;

grant select on public.feed_events to authenticated;
