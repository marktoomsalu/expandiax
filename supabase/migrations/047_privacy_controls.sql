-- Privacy controls: remove a follower, auto-approve pending requests when a
-- private account opens up, "Only me" per country, and opting out of search
-- and suggestions.

-- 1. Remove a follower without blocking them.
create policy "users remove their followers"
  on public.follows for delete
  using (followee_id = auth.uid());

-- 2. A private account that becomes public or friends-only no longer needs
--    requests: approve the pending ones (as if accepted one by one) instead
--    of leaving people stuck on "Requested".
create or replace function public.approve_requests_when_opened()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.visibility = 'private' and new.visibility <> 'private' then
    insert into public.follows (follower_id, followee_id)
    select requester_id, target_id from public.follow_requests where target_id = new.id
    on conflict do nothing;

    insert into public.notifications (user_id, actor_id, kind)
    select requester_id, target_id, 'follow_accepted' from public.follow_requests where target_id = new.id;

    delete from public.follow_requests where target_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_approve_requests_when_opened on public.profiles;
create trigger profiles_approve_requests_when_opened
  after update of visibility on public.profiles
  for each row execute function public.approve_requests_when_opened();

-- 3. "Only me" for a single country: hidden from everyone else — map,
--    counts, feed, likes and comments — while the rest of the profile
--    keeps its visibility. Its trips, cities and photos follow it, because
--    their policies all go through visited_country_is_public().
alter table public.visited_countries add column if not exists is_public boolean not null default true;

create or replace function public.visited_country_is_public(vc_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.visited_countries vc
    where vc.id = vc_id and vc.is_public and public.is_profile_public(vc.user_id)
  );
$$;

drop policy if exists "visited countries readable when owner or profile public" on public.visited_countries;
create policy "visited countries readable when owner or profile public"
  on public.visited_countries for select
  using (user_id = auth.uid() or (is_public and public.is_profile_public(user_id)));

-- 4. Not showing up in search or "people you may know" style suggestions.
--    Followers and people you interact with can still see you as before.
alter table public.profiles add column if not exists discoverable boolean not null default true;
