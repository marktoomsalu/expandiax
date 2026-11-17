-- 078: "Who was with you?" Built on the shared posts of migration 075.
--
-- Someone added to a trip or event now chooses how it goes on their profile:
--   * Join the memory (as before): the post stays its owner's, and shows on
--     their profile too. Nothing to make.
--   * Create my own memory: their own trip or event, with the dates and
--     places filled in, linked to the original. Their own photos, words and
--     privacy; it's their own post. (post_collaborators.own_target_id)
-- Someone who joined can make it their own later; any photos they had added
-- to the original move with them, so nothing is ever in two places.
--
-- Also:
--   * moment_invites: adding someone who isn't on ExpandiaX yet. They get a
--     link; once they join, it becomes a normal invitation to choose from.
--   * request_collab: "I was with Mark" on someone's trip or event. Mark gets
--     a notification and adds them (or not); then they choose as above.
--   * At most 20 people on one trip or event, invitations and links together.

-- 1. A person's own memory, linked to the original.
alter table public.post_collaborators add column if not exists own_target_id uuid;
create index if not exists post_collaborators_own_idx on public.post_collaborators (own_target_id) where own_target_id is not null;

-- Their own memory's page can say what it's linked to: the link is readable
-- by whoever can see that own memory.
drop policy if exists "collaborators readable" on public.post_collaborators;
create policy "collaborators readable" on public.post_collaborators for select
  using (
    owner_id = auth.uid()
    or user_id = auth.uid()
    or (status = 'accepted' and (
      (kind = 'event' and public.event_is_public(target_id))
      or (kind = 'trip' and public.country_visit_is_public(target_id))
      or (kind = 'event' and own_target_id is not null and public.event_is_public(own_target_id))
      or (kind = 'trip' and own_target_id is not null and public.country_visit_is_public(own_target_id))
    ))
  );

-- 2. Create my own memory (from an invitation, or after joining).
--    Returns the new trip's or event's id.
create or replace function public.make_own_memory(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.post_collaborators;
  v public.country_visits;
  code text;
  cname text;
  my_vc uuid;
  new_id uuid;
begin
  if me is null then return null; end if;
  select * into r from public.post_collaborators where id = p_id and user_id = me;
  if not found then return null; end if;
  if r.own_target_id is not null then return r.own_target_id; end if;

  if r.kind = 'trip' then
    select * into v from public.country_visits where id = r.target_id;
    if not found then return null; end if;
    select country_code, country_name into code, cname from public.visited_countries where id = v.visited_country_id;
    insert into public.visited_countries (user_id, country_code, country_name)
    values (me, code, cname)
    on conflict (user_id, country_code) do nothing;
    select id into my_vc from public.visited_countries where user_id = me and country_code = code;

    insert into public.country_visits (visited_country_id, year, visited_from, visited_to, date_precision, kind, title, highlight)
    values (my_vc, v.year, v.visited_from, v.visited_to, v.date_precision, v.kind, v.title, '')
    returning id into new_id;

    -- The same places, with their days.
    insert into public.country_cities (visited_country_id, country_visit_id, city_name, position, lat, lng, arrived, departed)
    select my_vc, new_id, city_name, position, lat, lng, arrived, departed
    from public.country_cities where country_visit_id = r.target_id;

    -- Photos they'd added to the original move to their own (under the same place name).
    update public.country_media m
    set country_visit_id = new_id,
        visited_country_id = my_vc,
        city_id = (
          select nc.id from public.country_cities nc
          join public.country_cities oc on oc.id = m.city_id
          where nc.country_visit_id = new_id and nc.city_name = oc.city_name
          limit 1
        )
    where m.country_visit_id = r.target_id and m.added_by = me;

  elsif r.kind = 'event' then
    insert into public.events (user_id, event_type, title, subtitle, event_date, venue, city, country_code, country_name,
                               spotify_artist_id, spotify_artist_name, spotify_artist_image)
    select me, event_type, title, subtitle, event_date, venue, city, country_code, country_name,
           spotify_artist_id, spotify_artist_name, spotify_artist_image
    from public.events where id = r.target_id
    returning id into new_id;
    if new_id is null then return null; end if;
    update public.event_media set event_id = new_id where event_id = r.target_id and added_by = me;
  else
    return null;
  end if;

  update public.notifications set read = true
  where user_id = me and kind = 'collab_invite' and target_id = r.target_id;
  if r.status = 'invited' then
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
    values (r.owner_id, me, 'collab_accepted', r.kind, r.target_id);
  end if;
  update public.post_collaborators
  set status = 'accepted', own_target_id = new_id, can_edit = false, responded_at = coalesce(responded_at, now())
  where id = p_id;
  return new_id;
end;
$$;

revoke all on function public.make_own_memory(uuid) from public, anon;
grant execute on function public.make_own_memory(uuid) to authenticated;

-- 3. Adding someone who isn't on ExpandiaX yet: a link for them.
create table if not exists public.moment_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  kind text not null check (kind in ('trip', 'event')),
  target_id uuid not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists moment_invites_target_idx on public.moment_invites (kind, target_id);
alter table public.moment_invites enable row level security;

-- Owners see and remove their own links; making and claiming go through functions.
drop policy if exists "moment invites: owner reads" on public.moment_invites;
create policy "moment invites: owner reads" on public.moment_invites for select using (owner_id = auth.uid());
drop policy if exists "moment invites: owner removes" on public.moment_invites;
create policy "moment invites: owner removes" on public.moment_invites for delete using (owner_id = auth.uid());

create or replace function public.create_moment_invite(p_kind text, p_target uuid, p_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  owner uuid;
  n int;
  t text;
begin
  if me is null then return null; end if;
  if p_kind = 'trip' then
    select vc.user_id into owner from public.country_visits v join public.visited_countries vc on vc.id = v.visited_country_id where v.id = p_target;
  elsif p_kind = 'event' then
    select user_id into owner from public.events where id = p_target;
  end if;
  if owner is null or owner <> me then return null; end if;
  select (select count(*) from public.post_collaborators where kind = p_kind and target_id = p_target)
       + (select count(*) from public.moment_invites where kind = p_kind and target_id = p_target and claimed_by is null)
  into n;
  if n >= 20 then return 'too_many'; end if;
  insert into public.moment_invites (kind, target_id, owner_id, name)
  values (p_kind, p_target, me, left(trim(coalesce(p_name, '')), 60))
  returning token into t;
  return t;
end;
$$;
revoke all on function public.create_moment_invite(text, uuid, text) from public, anon;
grant execute on function public.create_moment_invite(text, uuid, text) to authenticated;

-- The 20 includes links not used yet.
create or replace function public.invite_collaborator(p_kind text, p_target uuid, p_user uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  owner uuid;
  n int;
begin
  if me is null then return 'signed_out'; end if;
  if p_kind = 'trip' then
    select vc.user_id into owner from public.country_visits v join public.visited_countries vc on vc.id = v.visited_country_id where v.id = p_target;
  elsif p_kind = 'event' then
    select user_id into owner from public.events where id = p_target;
  else
    return 'bad_kind';
  end if;
  if owner is null or owner <> me then return 'not_owner'; end if;
  if p_user = me then return 'self'; end if;
  if private.is_blocked_between(me, p_user) then return 'blocked'; end if;
  select (select count(*) from public.post_collaborators where kind = p_kind and target_id = p_target)
       + (select count(*) from public.moment_invites where kind = p_kind and target_id = p_target and claimed_by is null)
  into n;
  if n >= 20 then return 'too_many'; end if;
  insert into public.post_collaborators (kind, target_id, owner_id, user_id)
  values (p_kind, p_target, me, p_user)
  on conflict (kind, target_id, user_id) do nothing;
  if found then
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
    values (p_user, me, 'collab_invite', p_kind, p_target);
  end if;
  return 'ok';
end;
$$;

-- An invite link to a trip, opened on a phone that then installs the app:
-- which trip, kept with the click (migration 072) until they sign up.
alter table public.invite_clicks add column if not exists moment_token text;

-- 4. "I was with Mark": ask to be added.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'question', 'answer', 'invite_joined', 'collab_invite', 'collab_accepted', 'collab_request'));

create or replace function public.request_collab(p_kind text, p_target uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then return 'signed_out'; end if;
  if p_kind = 'trip' then
    if not public.country_visit_is_public(p_target) then return 'not_found'; end if;
    select vc.user_id into owner from public.country_visits v join public.visited_countries vc on vc.id = v.visited_country_id where v.id = p_target;
  elsif p_kind = 'event' then
    if not public.event_is_public(p_target) then return 'not_found'; end if;
    select user_id into owner from public.events where id = p_target;
  else
    return 'bad_kind';
  end if;
  if owner is null then return 'not_found'; end if;
  if owner = me then return 'self'; end if;
  if private.is_blocked_between(me, owner) then return 'not_found'; end if;
  if exists (select 1 from public.post_collaborators where kind = p_kind and target_id = p_target and user_id = me) then return 'already'; end if;
  if exists (select 1 from public.notifications where user_id = owner and actor_id = me and kind = 'collab_request' and target_id = p_target) then return 'sent'; end if;
  insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
  values (owner, me, 'collab_request', p_kind, p_target);
  return 'sent';
end;
$$;
revoke all on function public.request_collab(text, uuid) from public, anon;
grant execute on function public.request_collab(text, uuid) to authenticated;

-- A deleted trip or event takes its links and requests with it.
create or replace function public.collab_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.post_collaborators where kind = tg_argv[0] and target_id = old.id;
  delete from public.moment_invites where kind = tg_argv[0] and target_id = old.id;
  delete from public.notifications where kind in ('collab_invite', 'collab_accepted', 'collab_request') and target_kind = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;
