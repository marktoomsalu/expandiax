-- ============================================================
-- Feed upgrades: per-entry "share to feed" toggle, hearts (likes), and a
-- richer feed_events view that falls back to the first photo/video when no
-- cover is explicitly set (and now also carries video, not just images).
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.visited_countries add column share_to_feed boolean not null default true;
alter table public.concerts add column share_to_feed boolean not null default true;

-- ---------- Likes ----------

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('country', 'concert')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, target_id)
);

create index likes_target_idx on public.likes (kind, target_id);

alter table public.likes enable row level security;

create policy "likes readable when target visible"
  on public.likes for select
  using (
    (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
    or
    (kind = 'concert' and (public.owns_concert(target_id) or public.concert_is_public(target_id)))
  );

create policy "users like visible content"
  on public.likes for insert
  with check (
    user_id = auth.uid()
    and (
      (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
      or
      (kind = 'concert' and (public.owns_concert(target_id) or public.concert_is_public(target_id)))
    )
  );

create policy "users unlike" on public.likes for delete
  using (user_id = auth.uid());

-- ---------- Feed events v2 ----------
-- Falls back to the first photo/video (by display_order) when no cover is
-- explicitly set, and now carries media_type so the feed can render video.

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
    vc.created_at as created_at
  from public.visited_countries vc
  left join lateral (
    select public_url, media_type
    from public.country_media
    where visited_country_id = vc.id
    order by (id = vc.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
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
