-- ============================================================
-- ExpandiaX — Supabase schema, security and storage setup
-- Run this whole file in the Supabase SQL editor (or via CLI).
-- Safe to run once on a fresh project.
-- ============================================================

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  home_country_code text,
  visibility text not null default 'private' check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visited_countries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  note text not null default '',
  cover_media_id uuid, -- FK added below (circular reference)
  is_favourite boolean not null default false,
  share_to_feed boolean not null default true,
  -- The soundtrack of that trip — a Spotify track, cached at pick time so
  -- pages can render it without a live Spotify call. Played via Spotify's
  -- official embed widget, never streamed directly.
  spotify_track_id text,
  spotify_track_name text,
  spotify_track_artist text,
  spotify_track_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, country_code)
);

create table public.country_visits (
  id uuid primary key default gen_random_uuid(),
  visited_country_id uuid not null references public.visited_countries (id) on delete cascade,
  year int not null check (year between 1900 and 2100),
  visited_from date,
  visited_to date,
  -- 'year': only the year is known. 'month': visited_from/visited_to span
  -- the first/last day of a remembered month. 'day': an exact date (or
  -- range) was entered. Lets the UI render "August 2023" instead of a
  -- fabricated exact date when someone only remembers the month.
  date_precision text not null default 'year' check (date_precision in ('year', 'month', 'day')),
  highlight text not null default '' check (length(highlight) <= 500),
  check (visited_to is null or visited_from is null or visited_to >= visited_from)
);

create table public.country_cities (
  id uuid primary key default gen_random_uuid(),
  visited_country_id uuid not null references public.visited_countries (id) on delete cascade,
  city_name text not null check (length(city_name) between 1 and 80)
);

create table public.country_media (
  id uuid primary key default gen_random_uuid(),
  visited_country_id uuid not null references public.visited_countries (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  media_type text not null default 'image' check (media_type = 'image'),
  caption text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.visited_countries
  add constraint visited_countries_cover_media_fk
  foreign key (cover_media_id) references public.country_media (id) on delete set null;

-- Events: concerts, festivals, sport, conferences, personal occasions
-- (weddings etc.) or anything else — event_type is just a label, every
-- event shares the same fields.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null default 'concert'
    check (event_type in ('concert', 'festival', 'sport', 'conference', 'personal', 'other')),
  title text not null check (length(title) between 1 and 120),
  subtitle text not null default '',
  event_date date not null,
  venue text not null default '',
  city text not null default '',
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  rating int check (rating between 1 and 10),
  review text not null default '',
  highlight text not null default '',
  notes text not null default '',
  cover_media_id uuid, -- FK added below
  is_favourite boolean not null default false,
  is_public boolean not null default true,
  share_to_feed boolean not null default true,
  -- A concert/festival's Spotify artist — their photo stands in as the
  -- event's cover when no photo has been uploaded yet.
  spotify_artist_id text,
  spotify_artist_name text,
  spotify_artist_image text,
  -- A concert's favourite song, connected to an actual Spotify track for
  -- playback. `highlight` holds the display name, kept in sync at pick time.
  spotify_favourite_track_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.events
  add constraint events_cover_media_fk
  foreign key (cover_media_id) references public.event_media (id) on delete set null;

-- ---------- Indexes ----------

create index visited_countries_user_idx on public.visited_countries (user_id);
create index country_visits_vc_idx on public.country_visits (visited_country_id);
create index country_cities_vc_idx on public.country_cities (visited_country_id);
create index country_media_vc_idx on public.country_media (visited_country_id, display_order);
create index events_user_date_idx on public.events (user_id, event_date desc);
create index events_country_idx on public.events (user_id, country_code);
create index event_media_event_idx on public.event_media (event_id, display_order);
create index profiles_visibility_idx on public.profiles (visibility) where visibility = 'public';

-- ---------- Helper functions ----------

-- Mutual-follow check, used by the "friends" visibility tier.
create or replace function public.is_mutual_follow(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (select 1 from public.follows where follower_id = a and followee_id = b)
    and exists (select 1 from public.follows where follower_id = b and followee_id = a);
$$;

-- Whether the target profile currently accepts a new follow at all.
-- "friends" profiles can still be followed by anyone (that's how you
-- become mutual); only "private" blocks new follows outright.
create or replace function public.profile_allows_follow(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select visibility <> 'private' from public.profiles where id = profile_id), false);
$$;

-- "Is this profile visible to the current viewer" — accounts for public,
-- friends (mutual followers only) and private.
create or replace function public.is_profile_public(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case (select visibility from public.profiles where id = profile_id)
    when 'public' then true
    when 'friends' then public.is_mutual_follow(auth.uid(), profile_id)
    else false
  end;
$$;

create or replace function public.owns_visited_country(vc_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.visited_countries
    where id = vc_id and user_id = auth.uid()
  );
$$;

create or replace function public.visited_country_is_public(vc_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.visited_countries vc
    where vc.id = vc_id and public.is_profile_public(vc.user_id)
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger visited_countries_touch before update on public.visited_countries
  for each row execute function public.set_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
-- Username and display name are passed via auth metadata at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Traveller')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Media caps enforced in the database ----------

create or replace function public.enforce_country_media_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.country_media
      where visited_country_id = new.visited_country_id) >= 5 then
    raise exception 'A country can have at most 5 photos.';
  end if;
  return new;
end;
$$;

create trigger country_media_cap before insert on public.country_media
  for each row execute function public.enforce_country_media_cap();

create or replace function public.enforce_event_media_cap()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from public.event_media
  where event_id = new.event_id and media_type = new.media_type;
  if new.media_type = 'image' and n >= 5 then
    raise exception 'An event can have at most 5 photos.';
  end if;
  if new.media_type = 'video' and n >= 3 then
    raise exception 'An event can have at most 3 videos.';
  end if;
  return new;
end;
$$;

create trigger event_media_cap before insert on public.event_media
  for each row execute function public.enforce_event_media_cap();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.visited_countries enable row level security;
alter table public.country_visits enable row level security;
alter table public.country_cities enable row level security;
alter table public.country_media enable row level security;
alter table public.events enable row level security;
alter table public.event_media enable row level security;

-- profiles
create policy "profiles are viewable when visible or own"
  on public.profiles for select
  using (id = auth.uid() or public.is_profile_public(id));

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "users insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- visited_countries
create policy "visited countries readable when owner or profile public"
  on public.visited_countries for select
  using (user_id = auth.uid() or public.is_profile_public(user_id));

create policy "owner manages visited countries insert"
  on public.visited_countries for insert with check (user_id = auth.uid());
create policy "owner manages visited countries update"
  on public.visited_countries for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner manages visited countries delete"
  on public.visited_countries for delete using (user_id = auth.uid());

-- country child tables (visits, cities, media) share the same rules
create policy "country visits readable" on public.country_visits for select
  using (public.owns_visited_country(visited_country_id)
         or public.visited_country_is_public(visited_country_id));
create policy "country visits insert" on public.country_visits for insert
  with check (public.owns_visited_country(visited_country_id));
create policy "country visits delete" on public.country_visits for delete
  using (public.owns_visited_country(visited_country_id));

create policy "country cities readable" on public.country_cities for select
  using (public.owns_visited_country(visited_country_id)
         or public.visited_country_is_public(visited_country_id));
create policy "country cities insert" on public.country_cities for insert
  with check (public.owns_visited_country(visited_country_id));
create policy "country cities delete" on public.country_cities for delete
  using (public.owns_visited_country(visited_country_id));

create policy "country media readable" on public.country_media for select
  using (public.owns_visited_country(visited_country_id)
         or public.visited_country_is_public(visited_country_id));
create policy "country media insert" on public.country_media for insert
  with check (public.owns_visited_country(visited_country_id));
create policy "country media update" on public.country_media for update
  using (public.owns_visited_country(visited_country_id))
  with check (public.owns_visited_country(visited_country_id));
create policy "country media delete" on public.country_media for delete
  using (public.owns_visited_country(visited_country_id));

-- events
create policy "events readable when owner or public"
  on public.events for select
  using (user_id = auth.uid()
         or (is_public and public.is_profile_public(user_id)));
create policy "owner inserts events" on public.events for insert
  with check (user_id = auth.uid());
create policy "owner updates events" on public.events for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner deletes events" on public.events for delete
  using (user_id = auth.uid());

-- event media follows the parent event
create or replace function public.owns_event(e_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.events where id = e_id and user_id = auth.uid());
$$;

create or replace function public.event_is_public(e_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = e_id and e.is_public and public.is_profile_public(e.user_id)
  );
$$;

create policy "event media readable" on public.event_media for select
  using (public.owns_event(event_id) or public.event_is_public(event_id));
create policy "event media insert" on public.event_media for insert
  with check (public.owns_event(event_id));
create policy "event media update" on public.event_media for update
  using (public.owns_event(event_id))
  with check (public.owns_event(event_id));
create policy "event media delete" on public.event_media for delete
  using (public.owns_event(event_id));

-- ---------- Storage ----------
-- One public bucket. Every object lives under <user_id>/... so ownership
-- is enforced by matching the first folder to auth.uid().

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 314572800) -- 300 MB hard cap per object
on conflict (id) do nothing;

create policy "media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "users upload into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own objects"
  on storage.objects for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own objects"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- Social feed: follows + a live activity feed ----------

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

create policy "follows readable when public or involved"
  on public.follows for select
  using (
    public.is_profile_public(followee_id)
    or follower_id = auth.uid()
    or followee_id = auth.uid()
  );

create policy "users follow non-private profiles"
  on public.follows for insert
  with check (follower_id = auth.uid() and public.profile_allows_follow(followee_id));

create policy "users unfollow"
  on public.follows for delete
  using (follower_id = auth.uid());

-- security_invoker means this view enforces the RLS of visited_countries /
-- events / country_media / event_media as the querying user. Falls back to
-- the first photo/video (by display_order) when no cover is explicitly
-- set, and carries media_type so the feed can render video too. visit_year/
-- visit_date carry when the thing actually happened (most recent logged
-- visit for countries, the event date for events) — not when it was added
-- to the app. event_type is null for country entries.
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
    vc.spotify_track_id as spotify_track_id,
    vc.spotify_track_name as spotify_track_name,
    vc.spotify_track_artist as spotify_track_artist,
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

-- ---------- Likes (hearts) ----------

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('country', 'event')),
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
    (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
  );

create policy "users like visible content"
  on public.likes for insert
  with check (
    user_id = auth.uid()
    and (
      (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
      or
      (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
    )
  );

create policy "users unlike" on public.likes for delete
  using (user_id = auth.uid());

-- ---------- Self-service account deletion ----------
-- Cascades through profiles -> visited_countries / events -> their child
-- tables via the existing "on delete cascade" foreign keys. Does not touch
-- Storage — the app removes uploaded files client-side before calling this.

create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- ---------- Explore page performance ----------
-- Per-user country counts computed in the database instead of pulling raw
-- rows into JS. security_invoker means it only ever sees what RLS already
-- allows the querying role to see.

create view public.public_country_counts
with (security_invoker = true) as
  select user_id, count(*) as country_count
  from public.visited_countries
  group by user_id;

grant select on public.public_country_counts to anon, authenticated;

-- ---------- Content reporting ----------
-- Write-only from the app's side — no admin UI yet, review via the Table
-- Editor (Table Editor -> reports) until one exists.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'event', 'country')),
  target_id uuid not null,
  target_url text not null,
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

create index reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

create policy "users file reports" on public.reports for insert
  with check (reporter_id = auth.uid());

-- ---------- Follow notification email ----------
-- Fires the notify-follow Edge Function (supabase/functions/notify-follow)
-- on every new follow. Deploy the function first:
--   npx supabase functions deploy notify-follow --no-verify-jwt

create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_notify_follow()
returns trigger
language plpgsql
as $$
begin
  perform net.http_post(
    url := 'https://ynjiqozehyipeuaxqroe.supabase.co/functions/v1/notify-follow',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

create trigger notify_follow_after_insert
  after insert on public.follows
  for each row execute function public.trigger_notify_follow();
