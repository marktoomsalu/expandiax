-- ============================================================
-- World Connect: dream places, when both say yes.
--
-- After two phones touch (migration 058), each person can tap "Yes, show
-- mine" under "Show each other your dream places?". Only when both have
-- said yes does either side get the other's dream places (want_to_go),
-- which otherwise only their owner ever sees. Same one-hour window as the
-- rest of the touch.
-- ============================================================

alter table public.globe_touches add column if not exists share_dreams boolean not null default false;

-- Someone's dream places as World Connect shows them.
create or replace function private.globe_touch_dreams(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', w.country_code, 'place', w.place_name) order by w.created_at desc), '[]'::jsonb)
  from public.want_to_go w
  where w.user_id = p_user;
$$;

-- Say yes to showing each other your dream places.
create or replace function public.globe_touch_share_dreams(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  peer uuid;
begin
  peer := private.globe_touch_peer(p_code, interval '1 hour');
  if me is null or peer is null then
    raise exception 'Touch phones again to share dream places.';
  end if;
  update public.globe_touches set share_dreams = true where code = p_code and user_id = me;
  return true;
end;
$$;

-- globe_touch (from 058), now also telling who said yes to dream places,
-- and once both have, both lists.
create or replace function public.globe_touch(p_code text, p_peer_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  peer uuid;
  p public.profiles%rowtype;
  i_dreams boolean;
  they_dreams boolean;
  result jsonb;
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
  select share_dreams into i_dreams from public.globe_touches where code = p_code;
  select share_dreams into they_dreams from public.globe_touches where code = p_peer_code;

  result := jsonb_build_object(
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
    'they_requested', exists (select 1 from public.follow_requests where requester_id = peer and target_id = me),
    'i_share_dreams', coalesce(i_dreams, false),
    'they_share_dreams', coalesce(they_dreams, false)
  );

  if coalesce(i_dreams, false) and coalesce(they_dreams, false) then
    result := result || jsonb_build_object(
      'my_dreams', private.globe_touch_dreams(me),
      'peer_dreams', private.globe_touch_dreams(peer)
    );
  end if;

  return result;
end;
$$;

revoke all on function private.globe_touch_dreams(uuid) from public;
revoke all on function public.globe_touch_share_dreams(text) from public, anon;
grant execute on function public.globe_touch_share_dreams(text) to authenticated;
