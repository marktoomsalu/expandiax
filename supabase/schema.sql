-- ============================================================
-- Atlas & Encore — Supabase schema, security and storage setup
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
  is_public boolean not null default false,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, country_code)
);

create table public.country_visits (
  id uuid primary key default gen_random_uuid(),
  visited_country_id uuid not null references public.visited_countries (id) on delete cascade,
  year int not null check (year between 1900 and 2100),
  visited_on date,
  highlight text not null default '' check (length(highlight) <= 500)
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

create table public.concerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  artist_name text not null check (length(artist_name) between 1 and 120),
  concert_name text not null default '',
  concert_date date not null,
  venue text not null default '',
  city text not null default '',
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  rating int check (rating between 1 and 5),
  review text not null default '',
  favourite_song text not null default '',
  setlist_notes text not null default '',
  cover_media_id uuid, -- FK added below
  is_favourite boolean not null default false,
  is_public boolean not null default true,
  share_to_feed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.concert_media (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.concerts (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.concerts
  add constraint concerts_cover_media_fk
  foreign key (cover_media_id) references public.concert_media (id) on delete set null;

-- ---------- Indexes ----------

create index visited_countries_user_idx on public.visited_countries (user_id);
create index country_visits_vc_idx on public.country_visits (visited_country_id);
create index country_cities_vc_idx on public.country_cities (visited_country_id);
create index country_media_vc_idx on public.country_media (visited_country_id, display_order);
create index concerts_user_date_idx on public.concerts (user_id, concert_date desc);
create index concerts_country_idx on public.concerts (user_id, country_code);
create index concert_media_concert_idx on public.concert_media (concert_id, display_order);
create index profiles_public_idx on public.profiles (is_public) where is_public;

-- ---------- Helper functions ----------

create or replace function public.is_profile_public(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_public from public.profiles where id = profile_id), false);
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
    select 1
    from public.visited_countries vc
    join public.profiles p on p.id = vc.user_id
    where vc.id = vc_id and p.is_public
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
create trigger concerts_touch before update on public.concerts
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

create or replace function public.enforce_concert_media_cap()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from public.concert_media
  where concert_id = new.concert_id and media_type = new.media_type;
  if new.media_type = 'image' and n >= 5 then
    raise exception 'A concert can have at most 5 photos.';
  end if;
  if new.media_type = 'video' and n >= 3 then
    raise exception 'A concert can have at most 3 videos.';
  end if;
  return new;
end;
$$;

create trigger concert_media_cap before insert on public.concert_media
  for each row execute function public.enforce_concert_media_cap();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.visited_countries enable row level security;
alter table public.country_visits enable row level security;
alter table public.country_cities enable row level security;
alter table public.country_media enable row level security;
alter table public.concerts enable row level security;
alter table public.concert_media enable row level security;

-- profiles
create policy "profiles are viewable when public or own"
  on public.profiles for select
  using (is_public or id = auth.uid());

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

-- concerts
create policy "concerts readable when owner or public"
  on public.concerts for select
  using (user_id = auth.uid()
         or (is_public and public.is_profile_public(user_id)));
create policy "owner inserts concerts" on public.concerts for insert
  with check (user_id = auth.uid());
create policy "owner updates concerts" on public.concerts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner deletes concerts" on public.concerts for delete
  using (user_id = auth.uid());

-- concert media follows the parent concert
create or replace function public.owns_concert(c_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.concerts where id = c_id and user_id = auth.uid());
$$;

create or replace function public.concert_is_public(c_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.concerts c
    join public.profiles p on p.id = c.user_id
    where c.id = c_id and c.is_public and p.is_public
  );
$$;

create policy "concert media readable" on public.concert_media for select
  using (public.owns_concert(concert_id) or public.concert_is_public(concert_id));
create policy "concert media insert" on public.concert_media for insert
  with check (public.owns_concert(concert_id));
create policy "concert media update" on public.concert_media for update
  using (public.owns_concert(concert_id))
  with check (public.owns_concert(concert_id));
create policy "concert media delete" on public.concert_media for delete
  using (public.owns_concert(concert_id));

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

create policy "users follow public profiles"
  on public.follows for insert
  with check (follower_id = auth.uid() and public.is_profile_public(followee_id));

create policy "users unfollow"
  on public.follows for delete
  using (follower_id = auth.uid());

-- security_invoker means this view enforces the RLS of visited_countries /
-- concerts / country_media / concert_media as the querying user. Falls back
-- to the first photo/video (by display_order) when no cover is explicitly
-- set, and carries media_type so the feed can render video too.
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

-- ---------- Likes (hearts) ----------

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

-- ---------- Self-service account deletion ----------
-- Cascades through profiles -> visited_countries / concerts -> their child
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
  target_type text not null check (target_type in ('profile', 'concert', 'country')),
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
