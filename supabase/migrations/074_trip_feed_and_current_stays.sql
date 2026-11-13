-- ============================================================
-- Trips choose for themselves whether they go to followers' feeds, a stay
-- can still be going on, and a post's picture prefers a photo.
--
-- 1. country_visits.show_in_feed: "Show in feed" on each trip (on by
--    default). Off: the trip stays on the profile but isn't posted to
--    followers' feeds. "Only me" trips are never in feeds anyway.
--    Replaces the country-wide "In your followers' feeds" switch: trips of
--    countries that had it off start with it off.
-- 2. country_visits.is_current: "I still live here", a stay with a start
--    and no end yet.
-- 3. feed_events: a country is in feeds when one of its trips is (or it
--    has no trips yet); its post is about its latest trip that's in feeds.
--    A post's picture is a photo first, then (events) the Spotify artist
--    picture, and only then a video, so a video-only event still shows
--    its artist instead of a grey card.
-- ============================================================

-- 1–2. The new columns.
alter table public.country_visits add column if not exists show_in_feed boolean not null default true;
alter table public.country_visits add column if not exists is_current boolean not null default false;

-- Countries kept out of feeds: their trips are now kept out instead, and
-- the country switch goes back to on (it's no longer shown anywhere).
update public.country_visits v
set show_in_feed = false
from public.visited_countries vc
where vc.id = v.visited_country_id and not vc.share_to_feed;

update public.visited_countries vc
set share_to_feed = true
where not vc.share_to_feed
  and exists (select 1 from public.country_visits v where v.visited_country_id = vc.id);

-- Whether a country has anything for feeds: a trip shown in feeds (and not
-- "Only me"), or no trips at all yet (a country just added).
create or replace function public.country_in_feed(vc_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.country_visits where visited_country_id = vc_id)
      or exists (
        select 1 from public.country_visits
        where visited_country_id = vc_id and show_in_feed and audience <> 'only_me'
      );
$$;
grant execute on function public.country_in_feed(uuid) to anon, authenticated;

-- 3. The feed.
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
    order by (media_type = 'image') desc, (id = vc.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
  left join lateral (
    select year, visited_from, visited_to, date_precision, highlight, spotify_track_id, spotify_track_name, spotify_track_artist
    from public.country_visits
    where visited_country_id = vc.id and show_in_feed
    order by is_current desc, coalesce(visited_to, visited_from, make_date(year, 12, 31)) desc
    limit 1
  ) lv on true
  where vc.share_to_feed and public.country_in_feed(vc.id)
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
    coalesce(img.public_url, e.spotify_artist_image, vid.public_url) as cover_url,
    case
      when img.public_url is not null or e.spotify_artist_image is not null then 'image'
      when vid.public_url is not null then 'video'
    end as cover_media_type,
    extract(year from e.event_date)::int as visit_year,
    e.event_date as visit_date,
    'day'::text as visit_date_precision,
    null::text as spotify_track_id,
    null::text as spotify_track_name,
    null::text as spotify_track_artist,
    e.created_at as created_at
  from public.events e
  left join lateral (
    select public_url
    from public.event_media
    where event_id = e.id and media_type = 'image'
    order by (id = e.cover_media_id) desc, display_order asc
    limit 1
  ) img on true
  left join lateral (
    select public_url
    from public.event_media
    where event_id = e.id and media_type = 'video'
    order by display_order asc
    limit 1
  ) vid on true
  where e.is_public and e.share_to_feed;
