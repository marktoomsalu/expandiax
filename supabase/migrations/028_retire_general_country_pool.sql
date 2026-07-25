-- ============================================================
-- Retire the general (visit-less) country note & photo pool.
--
-- Photos could already live outside any specific trip, but a
-- soundtrack could not — the two were inconsistent. Everything now
-- lives on a specific country_visits row, matching how soundtracks
-- already worked. Existing general data is preserved by folding it
-- into a visit, not deleted:
--   - a country with visits already: folded into its most recent visit
--   - a country with no visits yet: a new visit is created to hold it,
--     dated from when the country was first added
-- ============================================================

-- 1. Create a landing visit for any country that has general data
--    (a note or untagged photos) but zero visits yet.
insert into public.country_visits (visited_country_id, year, date_precision, highlight)
select vc.id, extract(year from vc.created_at)::int, 'year', vc.note
from public.visited_countries vc
where (nullif(vc.note, '') is not null
       or exists (select 1 from public.country_media cm where cm.visited_country_id = vc.id and cm.country_visit_id is null))
  and not exists (select 1 from public.country_visits cv where cv.visited_country_id = vc.id);

-- 2. Fold general notes into the most recent visit, for countries
--    that already had at least one visit — only where that visit's
--    own highlight is still empty, so nothing gets overwritten.
with target as (
  select distinct on (vc.id) vc.id as country_id, cv.id as visit_id
  from public.visited_countries vc
  join public.country_visits cv on cv.visited_country_id = vc.id
  where nullif(vc.note, '') is not null
  order by vc.id, coalesce(cv.visited_to, cv.visited_from, make_date(cv.year, 12, 31)) desc
)
update public.country_visits cv
set highlight = vc.note
from target t
join public.visited_countries vc on vc.id = t.country_id
where cv.id = t.visit_id
  and nullif(cv.highlight, '') is null;

-- 3. Reassign every general (untagged) photo to its country's most
--    recent visit (freshly created in step 1, or already existing).
with target as (
  select distinct on (cm.visited_country_id) cm.visited_country_id as country_id, cv.id as visit_id
  from public.country_media cm
  join public.country_visits cv on cv.visited_country_id = cm.visited_country_id
  where cm.country_visit_id is null
  order by cm.visited_country_id, coalesce(cv.visited_to, cv.visited_from, make_date(cv.year, 12, 31)) desc
)
update public.country_media cm
set country_visit_id = t.visit_id
from target t
where cm.visited_country_id = t.country_id
  and cm.country_visit_id is null;

-- 4. feed_events depends on visited_countries.note, so it must be
--    repointed at the most recent visit's highlight *before* that
--    column can be dropped below.
create or replace view public.feed_events
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
    nullif(lv.highlight, '') as body,
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
    select year, visited_from, visited_to, date_precision, highlight, spotify_track_id, spotify_track_name, spotify_track_artist
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

-- 5. Now safe to drop the migrated general note column, and require
--    every photo to belong to a visit going forward.
alter table public.visited_countries drop column note;
alter table public.country_media alter column country_visit_id set not null;
