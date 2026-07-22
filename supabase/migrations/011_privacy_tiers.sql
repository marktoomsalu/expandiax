-- ============================================================
-- Three-tier profile privacy: public / friends (mutual followers only) /
-- private. Replaces the old is_public boolean on profiles.
--
-- Every place that already gated on "is this profile public" (visited
-- countries, concerts, their media, likes, follows) delegates through
-- is_profile_public(), so updating that one function's body is what makes
-- the "friends" tier apply everywhere automatically — no need to touch
-- those policies individually.
--
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

-- ---------- Column swap ----------

alter table public.profiles
  add column visibility text not null default 'private'
  check (visibility in ('public', 'friends', 'private'));

update public.profiles set visibility = case when is_public then 'public' else 'private' end;

drop index if exists public.profiles_public_idx;
alter table public.profiles drop column is_public;

create index profiles_visibility_idx on public.profiles (visibility) where visibility = 'public';

-- ---------- Mutual-follow check ----------

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

-- ---------- Visibility-aware core check ----------
-- Now means "visible to the current viewer" (auth.uid()), not just "public".

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

create or replace function public.visited_country_is_public(vc_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.visited_countries vc
    where vc.id = vc_id and public.is_profile_public(vc.user_id)
  );
$$;

create or replace function public.concert_is_public(c_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.concerts c
    where c.id = c_id and c.is_public and public.is_profile_public(c.user_id)
  );
$$;

-- ---------- Policies that referenced is_public directly ----------

drop policy "profiles are viewable when public or own" on public.profiles;
create policy "profiles are viewable when visible or own"
  on public.profiles for select
  using (id = auth.uid() or public.is_profile_public(id));

drop policy "users follow public profiles" on public.follows;
create policy "users follow non-private profiles"
  on public.follows for insert
  with check (follower_id = auth.uid() and public.profile_allows_follow(followee_id));
