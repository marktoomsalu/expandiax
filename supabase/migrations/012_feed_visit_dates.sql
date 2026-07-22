-- ============================================================
-- Show when a visit/concert actually happened in the feed, not just when
-- it was added. For countries this is the most recently logged visit
-- (year, or an exact date/range if set); for concerts it's the concert
-- date itself.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

drop view if exists public.feed_events;

create view public.feed_events
with (security_invoker = true) as
  select
    'country'::text as kind,
    vc.id as ref_id,
    vc.user_id as actor_id,
    vc.country_code as country_code,
    vc.country_name as title,
    null::text as subtitle,
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    lv.year as visit_year,
    coalesce(lv.visited_to, lv.visited_from) as visit_date,
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
    select year, visited_from, visited_to
    from public.country_visits
    where visited_country_id = vc.id
    order by coalesce(visited_to, visited_from, make_date(year, 12, 31)) desc
    limit 1
  ) lv on true
  where vc.share_to_feed
  union all
  select
    'concert'::text as kind,
    c.id as ref_id,
    c.user_id as actor_id,
    c.country_code as country_code,
    c.artist_name as title,
    nullif(c.concert_name, '') as subtitle,
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    extract(year from c.concert_date)::int as visit_year,
    c.concert_date as visit_date,
    c.created_at as created_at
  from public.concerts c
  left join lateral (
    select public_url, media_type
    from public.concert_media
    where concert_id = c.id
    order by (id = c.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
  where c.is_public and c.share_to_feed;

grant select on public.feed_events to authenticated;
