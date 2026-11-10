-- ============================================================
-- Two kinds of account, and an audience for every post.
--
-- Accounts are public or private; "friends only" accounts become private
-- (people ask to follow, as Instagram). Each trip, stay and event says
-- who sees it:
--   everyone   "Feed": everyone who can see your profile (and in feeds)
--   friends    people you follow who follow you back
--   only_me    nobody else
-- A private account's posts are still only for the followers it approved,
-- whatever their audience.
--
-- is_public (migrations 047 / 061) stays, kept in step by a trigger
-- (only_me = false), for anything that still reads it.
-- ============================================================

-- 1. Friends-only accounts become private.
update public.profiles set visibility = 'private' where visibility = 'friends';
alter table public.profiles drop constraint if exists profiles_visibility_check;
alter table public.profiles add constraint profiles_visibility_check check (visibility in ('public', 'private'));

-- 2. Audiences, from what's set today.
alter table public.country_visits add column if not exists audience text not null default 'everyone'
  check (audience in ('everyone', 'friends', 'only_me'));
alter table public.events add column if not exists audience text not null default 'everyone'
  check (audience in ('everyone', 'friends', 'only_me'));
update public.country_visits set audience = 'only_me' where not is_public and audience = 'everyone';
update public.events set audience = 'only_me' where not is_public and audience = 'everyone';

create or replace function public.sync_is_public_from_audience()
returns trigger language plpgsql as $$
begin
  new.is_public := new.audience <> 'only_me';
  return new;
end;
$$;

drop trigger if exists country_visits_audience on public.country_visits;
create trigger country_visits_audience before insert or update of audience on public.country_visits
  for each row execute function public.sync_is_public_from_audience();
drop trigger if exists events_audience on public.events;
create trigger events_audience before insert or update of audience on public.events
  for each row execute function public.sync_is_public_from_audience();

-- 3. Whether the person asking may see a post with this audience.
create or replace function public.audience_allows(owner uuid, aud text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case aud
    when 'everyone' then true
    when 'friends' then auth.uid() is not null and public.is_mutual_follow(auth.uid(), owner)
    else false
  end;
$$;

-- No more friends-only accounts.
create or replace function public.is_profile_public(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is not null and private.is_blocked_between(auth.uid(), profile_id) then false
    else case (select visibility from public.profiles where id = profile_id)
      when 'public' then true
      when 'private' then exists (
        select 1 from public.follows where follower_id = auth.uid() and followee_id = profile_id
      )
      else false
    end
  end;
$$;

-- 4. Trips and stays (their places and photos follow them).
create or replace function public.country_visit_is_public(v_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.country_visits v
    join public.visited_countries vc on vc.id = v.visited_country_id
    where v.id = v_id
      and public.visited_country_is_public(vc.id)
      and public.audience_allows(vc.user_id, v.audience)
  );
$$;

drop policy if exists "country visits readable" on public.country_visits;
create policy "country visits readable" on public.country_visits for select
  using (public.owns_visited_country(visited_country_id) or public.country_visit_is_public(id));

-- 5. Events (their photos, likes and comments go through event_is_public).
create or replace function public.event_is_public(e_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = e_id and public.is_profile_public(e.user_id) and public.audience_allows(e.user_id, e.audience)
  );
$$;

drop policy if exists "events readable when owner or public" on public.events;
create policy "events readable when owner or public"
  on public.events for select
  using (user_id = auth.uid() or (public.is_profile_public(user_id) and public.audience_allows(user_id, audience)));

-- 6. Anonymous counts and World Connect only use posts for everyone.
create or replace function public.place_traveller_counts(p_country text)
returns table (place text, travellers bigint)
language sql stable security definer set search_path = public
as $$
  with seen as (
    select vc.id, vc.user_id
    from public.visited_countries vc
    join public.profiles p on p.id = vc.user_id
    where vc.country_code = upper(p_country)
      and vc.is_public
      and p.discoverable
      and (auth.uid() is null or not private.is_blocked_between(auth.uid(), vc.user_id))
  )
  select ''::text, count(distinct s.user_id) from seen s
  union all
  select min(trim(c.city_name)), count(distinct s.user_id)
  from seen s
  join public.country_cities c on c.visited_country_id = s.id
  join public.country_visits v on v.id = c.country_visit_id and v.audience = 'everyone'
  group by lower(trim(c.city_name));
$$;

create or replace function private.globe_touch_countries(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', vc.country_code,
    'lived', exists (select 1 from public.country_visits v where v.visited_country_id = vc.id and v.kind = 'lived' and v.audience = 'everyone')
  ) order by vc.country_code), '[]'::jsonb)
  from public.visited_countries vc
  where vc.user_id = p_user and vc.is_public;
$$;

-- 7. Going public without opening everything up: "No, I'll choose"
--    turns your posts for everyone into posts for friends, so nothing new
--    becomes public until you open it yourself.
create or replace function public.posts_to_friends()
returns void
language sql security definer set search_path = public
as $$
  update public.country_visits v set audience = 'friends'
  from public.visited_countries vc
  where vc.id = v.visited_country_id and vc.user_id = auth.uid() and v.audience = 'everyone';
  update public.events set audience = 'friends' where user_id = auth.uid() and audience = 'everyone';
$$;

revoke all on function public.audience_allows(uuid, text) from public;
grant execute on function public.audience_allows(uuid, text) to anon, authenticated;
revoke all on function public.posts_to_friends() from public, anon;
grant execute on function public.posts_to_friends() to authenticated;
