-- ============================================================
-- 1. Month-only trip dates ("I remember August, not the exact day").
--    Adds date_precision to country_visits: 'year' | 'month' | 'day'.
--    Existing rows are backfilled from what they already have —
--    an exact visited_from means they were entered at day precision,
--    otherwise year-only.
--
-- 2. Feed redesign: the feed now needs the country a public event took
--    place in, the text the owner actually wrote (event review / country
--    note), and — for countries — whether the shown visit date is a full
--    date or just a month, so it can render "August 2023" instead of
--    "August 31, 2023". feed_events is rebuilt to carry all three.
-- ============================================================

alter table public.country_visits
  add column date_precision text not null default 'year'
  check (date_precision in ('year', 'month', 'day'));

update public.country_visits
  set date_precision = 'day'
  where visited_from is not null;

drop view if exists public.feed_events;

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
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    lv.year as visit_year,
    coalesce(lv.visited_to, lv.visited_from) as visit_date,
    lv.date_precision as visit_date_precision,
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
    select year, visited_from, visited_to, date_precision
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
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    extract(year from e.event_date)::int as visit_year,
    e.event_date as visit_date,
    'day'::text as visit_date_precision,
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
