-- 083: Chapter One, the journey every new member goes on, and its badge.
--
-- Next Step (082) is retired: its functions and the columns only it used go.
-- member_progress stays for badges_seen (each badge celebrated once).
--
-- first_chapter() answers, for whoever is signed in, which of the eight
-- steps they've done, worked out from what they've actually done (so it
-- can't disagree with the app), plus where each step's button should go.
-- The first time all eight are done it stamps profiles.first_chapter_at,
-- which unlocks the Chapter One badge (on their profile too). The stamp
-- stays: deleting things later never takes the badge away.

drop function if exists public.note_next_step(text, text);
drop function if exists public.raise_member_stage(smallint);
alter table public.member_progress
  drop column if exists stage,
  drop column if exists moments,
  drop column if exists dismiss_streak,
  drop column if exists last_dismissed,
  drop column if exists paused_until;

alter table public.profiles add column if not exists first_chapter_at timestamptz;

create or replace function public.first_chapter()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  p public.profiles%rowtype;
  n_countries int;
  n_following int;
  s_introduce boolean;
  s_map boolean;
  s_trip boolean;
  s_event boolean;
  s_song boolean;
  s_people boolean;
  s_together boolean;
  s_hello boolean;
  latest_country text;
  trip_id uuid;
  trip_code text;
  event_id uuid;
begin
  if me is null then return null; end if;
  select * into p from public.profiles where id = me;
  if not found then return null; end if;

  select count(*) into n_countries from public.visited_countries where user_id = me;
  select count(*) into n_following from public.follows where follower_id = me;

  s_introduce := coalesce(trim(p.display_name), '') not in ('', 'Traveller') and coalesce(p.avatar_url, '') <> '';
  s_map := n_countries >= 3;
  s_trip := exists (
    select 1 from public.country_media cm
    join public.visited_countries vc on vc.id = cm.visited_country_id
    where vc.user_id = me and cm.country_visit_id is not null
  );
  s_event := exists (select 1 from public.events where user_id = me);
  s_song := exists (
    select 1 from public.country_visits v
    join public.visited_countries vc on vc.id = v.visited_country_id
    where vc.user_id = me and v.spotify_track_id is not null
  ) or exists (
    select 1 from public.events
    where user_id = me and (spotify_favourite_track_id is not null or (event_type = 'concert' and coalesce(trim(highlight), '') <> ''))
  );
  s_people := n_following >= 3;
  -- Someone on one of their memories, them on someone else's, or the same
  -- event (title and day) as someone they follow: "I was there".
  s_together := exists (select 1 from public.post_collaborators where owner_id = me or user_id = me)
    or exists (
      select 1 from public.events mine
      join public.events theirs
        on theirs.event_date = mine.event_date
       and lower(trim(theirs.title)) = lower(trim(mine.title))
       and theirs.user_id <> me
      join public.follows f on f.follower_id = me and f.followee_id = theirs.user_id
      where mine.user_id = me
    );
  s_hello := exists (select 1 from public.messages where sender_id = me);

  -- Where the buttons go.
  select country_code into latest_country from public.visited_countries
    where user_id = me order by created_at desc limit 1;
  select v.id, vc.country_code into trip_id, trip_code
    from public.country_visits v
    join public.visited_countries vc on vc.id = v.visited_country_id
    where vc.user_id = me
    order by coalesce(v.visited_from, make_date(v.year, 1, 1)) desc
    limit 1;
  select id into event_id from public.events where user_id = me order by event_date desc limit 1;

  if p.first_chapter_at is null and s_introduce and s_map and s_trip and s_event and s_song and s_people and s_together and s_hello then
    update public.profiles set first_chapter_at = now() where id = me returning first_chapter_at into p.first_chapter_at;
  end if;

  return jsonb_build_object(
    'steps', jsonb_build_object(
      'introduce', s_introduce, 'map', s_map, 'trip', s_trip, 'event', s_event,
      'song', s_song, 'people', s_people, 'together', s_together, 'hello', s_hello
    ),
    'countries', n_countries,
    'following', n_following,
    'latestCountry', latest_country,
    'trip', case when trip_id is null then null else jsonb_build_object('id', trip_id, 'code', trip_code) end,
    'event', event_id,
    'finishedAt', p.first_chapter_at
  );
end;
$$;

revoke all on function public.first_chapter() from public, anon;
grant execute on function public.first_chapter() to authenticated;
