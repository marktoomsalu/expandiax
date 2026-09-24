-- ============================================================
-- Blocking. A block is a personal boundary, not a punishment: it hides two
-- accounts from each other (both ways) and nothing else. It never removes,
-- suspends or flags an account by itself — that stays a human decision made
-- from reports (and the block_counts view below).
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

-- Helpers live in a schema PostgREST doesn't expose, so nobody can call
-- them from the API to find out who has blocked whom.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- You only ever see (and undo) your own blocks. The person you blocked can't
-- read this table, so they can't tell. No insert policy on purpose: blocking
-- goes through block_user() below so the clean-up always happens with it.
create policy "users see own blocks" on public.blocks for select
  using (blocker_id = auth.uid());

create policy "users unblock" on public.blocks for delete
  using (blocker_id = auth.uid());

-- True when either of the two has blocked the other.
create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function private.is_blocked_between(uuid, uuid) from public;
grant execute on function private.is_blocked_between(uuid, uuid) to anon, authenticated;

-- Profile visibility is the single gate that posts, photos, follows, likes,
-- comments and the feed already go through — a block simply closes it.
-- Everything else in this function is unchanged.
create or replace function public.is_profile_public(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is not null and private.is_blocked_between(auth.uid(), profile_id) then false
    else case (select visibility from public.profiles where id = profile_id)
      when 'public' then true
      when 'friends' then public.is_mutual_follow(auth.uid(), profile_id)
      when 'private' then exists (
        select 1 from public.follows where follower_id = auth.uid() and followee_id = profile_id
      )
      else false
    end
  end;
$$;

-- No new follows in either direction while a block exists.
create or replace function public.profile_allows_follow(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select visibility <> 'private' from public.profiles where id = profile_id), false)
    and not (auth.uid() is not null and private.is_blocked_between(auth.uid(), profile_id));
$$;

drop policy if exists "users request to follow private profiles" on public.follow_requests;
create policy "users request to follow private profiles" on public.follow_requests for insert
  with check (
    requester_id = auth.uid()
    and (select visibility from public.profiles where id = target_id) = 'private'
    and not private.is_blocked_between(auth.uid(), target_id)
    and not exists (
      select 1 from public.follows where follower_id = auth.uid() and followee_id = target_id
    )
  );

-- Search / discovery: any signed-in user can still find any profile, except
-- someone they're blocked with.
drop policy if exists "authenticated users can discover any profile" on public.profiles;
create policy "authenticated users can discover any profile"
  on public.profiles for select
  to authenticated
  using (not private.is_blocked_between(auth.uid(), id));

-- You never see comments or likes written by someone you're blocked with —
-- including on your own posts, which the "owner" branch would otherwise
-- always show. (Commenting or liking on each other's posts is already shut
-- by is_profile_public above.)
drop policy if exists "likes readable when target visible" on public.likes;
create policy "likes readable when target visible"
  on public.likes for select
  using (
    not private.is_blocked_between(auth.uid(), user_id)
    and (
      (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
      or
      (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
    )
  );

drop policy if exists "comments readable when target visible" on public.comments;
create policy "comments readable when target visible"
  on public.comments for select
  using (
    not private.is_blocked_between(auth.uid(), user_id)
    and (
      (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
      or
      (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
    )
  );

-- Blocking: records the block, then cuts every existing tie between the two
-- (follows and pending requests both ways, notifications either way). It runs
-- as the database owner because it has to delete rows that belong to the
-- other person. It touches nothing else about their account.
create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sign in to block someone.';
  end if;
  if p_blocked_id = v_me then
    raise exception 'You can''t block yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = p_blocked_id) then
    raise exception 'No such account.';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_me, p_blocked_id)
  on conflict do nothing;

  delete from public.follows
  where (follower_id = v_me and followee_id = p_blocked_id)
     or (follower_id = p_blocked_id and followee_id = v_me);

  delete from public.follow_requests
  where (requester_id = v_me and target_id = p_blocked_id)
     or (requester_id = p_blocked_id and target_id = v_me);

  delete from public.notifications
  where (user_id = v_me and actor_id = p_blocked_id)
     or (user_id = p_blocked_id and actor_id = v_me);
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- The blocked accounts' names, for the "Blocked accounts" list in Settings —
-- their profiles are hidden from you by the policy above, so this is the one
-- way to see them, and only your own.
create or replace function public.my_blocked_profiles()
returns table (id uuid, username text, display_name text, avatar_url text, blocked_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.my_blocked_profiles() from public, anon;
grant execute on function public.my_blocked_profiles() to authenticated;

-- For whoever reviews reports: accounts that several different people have
-- blocked. A signal to go and look — never an automatic action. Not readable
-- from the app (only the dashboard / service role), so nobody can see who
-- has been blocked by how many people.
create view public.block_counts as
  select blocked_id, count(*) as blocked_by, max(created_at) as latest_block
  from public.blocks
  group by blocked_id;

revoke all on public.block_counts from public, anon, authenticated;
