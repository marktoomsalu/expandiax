-- 079: what came out of testing "Who was with you?" (078).
--
-- 1. No duplicate trips. Someone added to a trip they've already logged
--    themselves (Melody's own India trip, then Mark's) links THAT trip,
--    instead of a new one: link_existing_memory. Their trip stays exactly as
--    it is, it's linked to Mark's, and it's still one visit. Someone who
--    already made a new one by mistake can switch it to their existing trip
--    the same way; anything in the new one moves over and the new one goes.
-- 2. An invitation says where it is: a link for someone not on ExpandiaX
--    yet is "sent" only once it's been shared (moment_invites.sent_at), and
--    "Not me" is kept as declined (so the person who asked can see it, and
--    ask again) instead of disappearing.

-- 1. Declined is a status of its own.
alter table public.post_collaborators drop constraint if exists post_collaborators_status_check;
alter table public.post_collaborators add constraint post_collaborators_status_check
  check (status in ('invited', 'accepted', 'declined'));

-- Declining no longer lets you see it (only invited and accepted people do).
create or replace function public.is_collaborator(p_kind text, p_target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.post_collaborators
    where kind = p_kind and target_id = p_target and user_id = auth.uid() and status <> 'declined'
  );
$$;

create or replace function public.collab_in_country(p_country uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.post_collaborators pc
    join public.country_visits v on v.id = pc.target_id
    where pc.kind = 'trip' and pc.user_id = auth.uid() and pc.status <> 'declined' and v.visited_country_id = p_country
  );
$$;

create or replace function public.respond_collab(p_id uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  r public.post_collaborators;
  code text;
  cname text;
begin
  select * into r from public.post_collaborators where id = p_id and user_id = auth.uid();
  if not found then return 'not_found'; end if;
  update public.notifications set read = true
  where user_id = auth.uid() and kind = 'collab_invite' and target_id = r.target_id;
  if not p_accept then
    update public.post_collaborators set status = 'declined', responded_at = now(), own_target_id = null where id = p_id;
    return 'declined';
  end if;
  if r.status = 'accepted' then return 'ok'; end if;
  update public.post_collaborators set status = 'accepted', responded_at = now() where id = p_id;
  if r.kind = 'trip' then
    select vc.country_code, vc.country_name into code, cname
    from public.country_visits v join public.visited_countries vc on vc.id = v.visited_country_id
    where v.id = r.target_id;
    if code is not null then
      insert into public.visited_countries (user_id, country_code, country_name)
      values (auth.uid(), code, cname)
      on conflict do nothing;
    end if;
  end if;
  insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
  values (r.owner_id, auth.uid(), 'collab_accepted', r.kind, r.target_id);
  return 'ok';
end;
$$;

-- Inviting someone who said "Not me" before asks them again. Declined
-- people don't count toward the 20.
create or replace function public.invite_collaborator(p_kind text, p_target uuid, p_user uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  owner uuid;
  n int;
  row_id uuid;
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
  select (select count(*) from public.post_collaborators where kind = p_kind and target_id = p_target and status <> 'declined')
       + (select count(*) from public.moment_invites where kind = p_kind and target_id = p_target and claimed_by is null)
  into n;
  if n >= 20 then return 'too_many'; end if;
  insert into public.post_collaborators (kind, target_id, owner_id, user_id)
  values (p_kind, p_target, me, p_user)
  on conflict (kind, target_id, user_id) do update
    set status = 'invited', responded_at = null, own_target_id = null, created_at = now()
    where public.post_collaborators.status = 'declined'
  returning id into row_id;
  if row_id is not null then
    delete from public.notifications where user_id = p_user and kind = 'collab_invite' and target_id = p_target;
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
    values (p_user, me, 'collab_invite', p_kind, p_target);
  end if;
  return 'ok';
end;
$$;

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
  select (select count(*) from public.post_collaborators where kind = p_kind and target_id = p_target and status <> 'declined')
       + (select count(*) from public.moment_invites where kind = p_kind and target_id = p_target and claimed_by is null)
  into n;
  if n >= 20 then return 'too_many'; end if;
  insert into public.moment_invites (kind, target_id, owner_id, name)
  values (p_kind, p_target, me, left(trim(coalesce(p_name, '')), 60))
  returning token into t;
  return t;
end;
$$;

-- 2. A link is sent once it's been shared.
alter table public.moment_invites add column if not exists sent_at timestamptz;

create or replace function public.mark_moment_invite_sent(p_id uuid)
returns text
language sql security definer set search_path = public
as $$
  update public.moment_invites set sent_at = coalesce(sent_at, now())
  where id = p_id and owner_id = auth.uid()
  returning 'ok';
$$;
revoke all on function public.mark_moment_invite_sent(uuid) from public, anon;
grant execute on function public.mark_moment_invite_sent(uuid) to authenticated;

-- 3. Link a trip or event you already have, instead of making a new one.
create or replace function public.link_existing_memory(p_id uuid, p_own uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.post_collaborators;
  target_code text;
  own_code text;
  own_vc uuid;
  old uuid;
begin
  if me is null then return null; end if;
  select * into r from public.post_collaborators where id = p_id and user_id = me;
  if not found or p_own = r.target_id then return null; end if;
  old := r.own_target_id;

  if r.kind = 'trip' then
    -- Yours, and in the same country.
    select vc.country_code into target_code
    from public.country_visits v join public.visited_countries vc on vc.id = v.visited_country_id where v.id = r.target_id;
    select vc.country_code, vc.id into own_code, own_vc
    from public.country_visits v join public.visited_countries vc on vc.id = v.visited_country_id
    where v.id = p_own and vc.user_id = me;
    if own_code is null or own_code is distinct from target_code then return null; end if;
    -- A new one made by mistake: what's in it moves over, then it goes.
    if old is not null and old <> p_own then
      update public.country_media set country_visit_id = p_own, visited_country_id = own_vc, city_id = null
      where country_visit_id = old;
      delete from public.country_visits v
      using public.visited_countries vc
      where v.id = old and vc.id = v.visited_country_id and vc.user_id = me;
    end if;
    -- Photos you'd added to theirs while you'd joined it.
    update public.country_media set country_visit_id = p_own, visited_country_id = own_vc, city_id = null
    where country_visit_id = r.target_id and added_by = me;

  elsif r.kind = 'event' then
    if not exists (select 1 from public.events where id = p_own and user_id = me) then return null; end if;
    if old is not null and old <> p_own then
      update public.event_media set event_id = p_own where event_id = old;
      delete from public.events where id = old and user_id = me;
    end if;
    update public.event_media set event_id = p_own where event_id = r.target_id and added_by = me;
  else
    return null;
  end if;

  update public.notifications set read = true
  where user_id = me and kind = 'collab_invite' and target_id = r.target_id;
  if r.status <> 'accepted' then
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
    values (r.owner_id, me, 'collab_accepted', r.kind, r.target_id);
  end if;
  update public.post_collaborators
  set status = 'accepted', own_target_id = p_own, can_edit = false, responded_at = coalesce(responded_at, now())
  where id = p_id;
  return p_own;
end;
$$;
revoke all on function public.link_existing_memory(uuid, uuid) from public, anon;
grant execute on function public.link_existing_memory(uuid, uuid) to authenticated;
