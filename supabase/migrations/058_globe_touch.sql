-- ============================================================
-- Touch globes: two people hold their iPhones together and see each
-- other's globe, the countries they've both been to, and can follow each
-- other.
--
-- How a touch is proven: each phone makes a random code and sends it to
-- the other over the encrypted local link. When the phones touch, each
-- one reports (my code, the code I received). Only when both reports
-- point at each other, within two minutes, is it a touch. Nobody can
-- claim a touch from across the room, because they'd need the code that
-- only the touched phone received.
--
-- Touching is the consent: for an hour afterwards each side sees the
-- other's globe (countries marked "Only me" stay hidden) and can follow,
-- even a private profile, once the other side has tapped follow too.
-- Blocks still win.
-- ============================================================

create table if not exists public.globe_touches (
  code text primary key check (code ~ '^[0-9a-f]{32}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  peer_code text not null check (peer_code ~ '^[0-9a-f]{32}$'),
  wants_follow boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists globe_touches_peer_code_idx on public.globe_touches (peer_code);
create index if not exists globe_touches_created_idx on public.globe_touches (created_at);

-- No policies: only the functions below read or write it.
alter table public.globe_touches enable row level security;

-- The other person in a touch, if both sides have reported it.
create or replace function private.globe_touch_peer(p_code text, p_within interval)
returns uuid
language sql stable security definer set search_path = public
as $$
  select theirs.user_id
  from public.globe_touches mine
  join public.globe_touches theirs on theirs.code = mine.peer_code and theirs.peer_code = mine.code
  where mine.code = p_code
    and mine.user_id = auth.uid()
    and theirs.user_id <> mine.user_id
    and abs(extract(epoch from theirs.created_at - mine.created_at)) < 120
    and mine.created_at > now() - p_within
    and not private.is_blocked_between(mine.user_id, theirs.user_id);
$$;

-- Someone's globe as the touch shows it: public countries, and whether
-- they lived there.
create or replace function private.globe_touch_countries(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', vc.country_code,
    'lived', exists (select 1 from public.country_visits v where v.visited_country_id = vc.id and v.kind = 'lived')
  ) order by vc.country_code), '[]'::jsonb)
  from public.visited_countries vc
  where vc.user_id = p_user and vc.is_public;
$$;

-- Report a touch, and get the other person once they've reported it too
-- (null until then: the phone asks again a few times). Asking again later
-- with the same codes is how the screen keeps the follow buttons current.
create or replace function public.globe_touch(p_code text, p_peer_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  peer uuid;
  p public.profiles%rowtype;
begin
  if me is null then
    raise exception 'Sign in to touch globes.';
  end if;

  delete from public.globe_touches where created_at < now() - interval '1 day';

  insert into public.globe_touches (code, user_id, peer_code)
  values (p_code, me, p_peer_code)
  on conflict (code) do nothing;

  if not exists (
    select 1 from public.globe_touches where code = p_code and user_id = me and peer_code = p_peer_code
  ) then
    raise exception 'That touch belongs to someone else.';
  end if;

  peer := private.globe_touch_peer(p_code, interval '1 hour');
  if peer is null then
    return null;
  end if;

  select * into p from public.profiles where id = peer;

  return jsonb_build_object(
    'peer', jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'home_country_code', p.home_country_code,
      'visibility', p.visibility
    ),
    'peer_countries', private.globe_touch_countries(peer),
    'my_countries', private.globe_touch_countries(me),
    'i_follow', exists (select 1 from public.follows where follower_id = me and followee_id = peer),
    'they_follow', exists (select 1 from public.follows where follower_id = peer and followee_id = me),
    'i_requested', exists (select 1 from public.follow_requests where requester_id = me and target_id = peer),
    'they_requested', exists (select 1 from public.follow_requests where requester_id = peer and target_id = me)
  );
end;
$$;

-- Follow the person you just touched globes with. Public and friends-only
-- profiles are followed straight away. A private profile is followed
-- straight away once they've tapped follow on you too; until then it's a
-- request. Your tap also lets their waiting request to you through.
-- Returns 'following' or 'requested'.
create or replace function public.globe_touch_follow(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  peer uuid;
  peer_private boolean;
  peer_wants boolean;
  state text;
begin
  peer := private.globe_touch_peer(p_code, interval '1 hour');
  if me is null or peer is null then
    raise exception 'Touch globes again to follow.';
  end if;

  update public.globe_touches set wants_follow = true where code = p_code and user_id = me;

  select visibility = 'private' into peer_private from public.profiles where id = peer;
  select theirs.wants_follow into peer_wants
  from public.globe_touches mine
  join public.globe_touches theirs on theirs.code = mine.peer_code
  where mine.code = p_code;

  if exists (select 1 from public.follows where follower_id = me and followee_id = peer) then
    state := 'following';
  elsif not peer_private or coalesce(peer_wants, false) then
    insert into public.follows (follower_id, followee_id) values (me, peer) on conflict do nothing;
    delete from public.follow_requests where requester_id = me and target_id = peer;
    state := 'following';
  else
    insert into public.follow_requests (requester_id, target_id) values (me, peer) on conflict do nothing;
    state := 'requested';
  end if;

  -- Tapping follow says "you can follow me too".
  if exists (select 1 from public.follow_requests where requester_id = peer and target_id = me) then
    insert into public.follows (follower_id, followee_id) values (peer, me) on conflict do nothing;
    delete from public.follow_requests where requester_id = peer and target_id = me;
  end if;

  return state;
end;
$$;

revoke all on function private.globe_touch_peer(text, interval) from public;
revoke all on function private.globe_touch_countries(uuid) from public;
revoke all on function public.globe_touch(text, text) from public, anon;
revoke all on function public.globe_touch_follow(text) from public, anon;
grant execute on function public.globe_touch(text, text) to authenticated;
grant execute on function public.globe_touch_follow(text) to authenticated;
