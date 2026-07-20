-- ============================================================
-- Social feed: follows + a live activity feed.
-- Run this once in the Supabase SQL editor on top of schema.sql.
-- ============================================================

-- ---------- Follows ----------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);
create index follows_follower_idx on public.follows (follower_id);

alter table public.follows enable row level security;

-- Follow edges are visible if the followee is public, or you're one of the
-- two people involved (so your own following/followers lists always work).
create policy "follows readable when public or involved"
  on public.follows for select
  using (
    public.is_profile_public(followee_id)
    or follower_id = auth.uid()
    or followee_id = auth.uid()
  );

-- You can only follow public profiles — no follow requests / approval flow.
-- Anything you'd see on a public profile is already visible without
-- following; following just curates your feed.
create policy "users follow public profiles"
  on public.follows for insert
  with check (follower_id = auth.uid() and public.is_profile_public(followee_id));

create policy "users unfollow"
  on public.follows for delete
  using (follower_id = auth.uid());

-- ---------- Feed ----------
-- security_invoker means this view enforces the RLS of visited_countries /
-- concerts / country_media / concert_media as the querying user — no
-- separate privacy logic to keep in sync.

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
    vc.created_at as created_at
  from public.visited_countries vc
  left join public.country_media cm on cm.id = vc.cover_media_id
  union all
  select
    'concert'::text as kind,
    c.id as ref_id,
    c.user_id as actor_id,
    c.country_code as country_code,
    c.artist_name as title,
    nullif(c.concert_name, '') as subtitle,
    cm.public_url as cover_url,
    c.created_at as created_at
  from public.concerts c
  left join public.concert_media cm on cm.id = c.cover_media_id
  where c.is_public;

grant select on public.feed_events to authenticated;
