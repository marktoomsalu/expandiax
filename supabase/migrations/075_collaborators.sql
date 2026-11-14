-- ============================================================
-- Collaborative posts, like Instagram's Collab: one trip or event shared
-- by the people who were there, instead of everyone making their own copy.
--
--   post_collaborators   who's invited to / part of a trip or event, and
--                        whether they may edit it. The post stays its
--                        owner's (one post: the same photos, words, likes
--                        and comments for everyone).
--
-- The owner invites (invite_collaborator); the invited person accepts or
-- declines (respond_collab); the owner gives or takes edit rights
-- (set_collab_edit) and removes people, and anyone can leave
-- (remove_collab). Accepting a trip puts its country on your map too.
-- All changes go through these functions; nobody writes the table directly.
--
-- Collaborators (and people invited, so they can look before deciding) can
-- see the trip or event whoever else may. Collaborators with edit rights
-- can change its words, places and photos, but never who sees it, whether
-- it's in feeds, or delete it, and only remove photos they added.
-- ============================================================

-- 1. The table.
create table if not exists public.post_collaborators (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('trip', 'event')),
  target_id uuid not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted')),
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (kind, target_id, user_id),
  check (user_id <> owner_id)
);
create index if not exists post_collaborators_user_idx on public.post_collaborators (user_id, status);
create index if not exists post_collaborators_target_idx on public.post_collaborators (kind, target_id);
alter table public.post_collaborators enable row level security;

-- Who added each photo or video (editors may only remove their own).
alter table public.country_media add column if not exists added_by uuid default auth.uid() references public.profiles (id) on delete set null;
alter table public.event_media add column if not exists added_by uuid default auth.uid() references public.profiles (id) on delete set null;

-- 2. Questions the rules ask.
create or replace function public.is_collaborator(p_kind text, p_target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.post_collaborators
    where kind = p_kind and target_id = p_target and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_as_collaborator(p_kind text, p_target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.post_collaborators
    where kind = p_kind and target_id = p_target and user_id = auth.uid() and status = 'accepted' and can_edit
  );
$$;

-- Whether you're part of (or invited to) a trip in this country of someone else's.
create or replace function public.collab_in_country(p_country uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.post_collaborators pc
    join public.country_visits v on v.id = pc.target_id
    where pc.kind = 'trip' and pc.user_id = auth.uid() and v.visited_country_id = p_country
  );
$$;

grant execute on function public.is_collaborator(text, uuid) to anon, authenticated;
grant execute on function public.can_edit_as_collaborator(text, uuid) to anon, authenticated;
grant execute on function public.collab_in_country(uuid) to anon, authenticated;

-- 3. Who can see who's on a post: the two people concerned, and, once
--    accepted, anyone who can see the post itself.
drop policy if exists "collaborators readable" on public.post_collaborators;
create policy "collaborators readable" on public.post_collaborators for select
  using (
    owner_id = auth.uid()
    or user_id = auth.uid()
    or (status = 'accepted' and (
      (kind = 'event' and public.event_is_public(target_id))
      or (kind = 'trip' and public.country_visit_is_public(target_id))
    ))
  );

-- 4. Seeing the trip or event (and its places, photos and country).
drop policy if exists "collaborators see the trip" on public.country_visits;
create policy "collaborators see the trip" on public.country_visits for select
  using (public.is_collaborator('trip', id));
drop policy if exists "collaborators see the trip's places" on public.country_cities;
create policy "collaborators see the trip's places" on public.country_cities for select
  using (public.is_collaborator('trip', country_visit_id));
drop policy if exists "collaborators see the trip's media" on public.country_media;
create policy "collaborators see the trip's media" on public.country_media for select
  using (public.is_collaborator('trip', country_visit_id));
drop policy if exists "collaborators see the trip's country" on public.visited_countries;
create policy "collaborators see the trip's country" on public.visited_countries for select
  using (public.collab_in_country(id));
drop policy if exists "collaborators see the event" on public.events;
create policy "collaborators see the event" on public.events for select
  using (public.is_collaborator('event', id));
drop policy if exists "collaborators see the event's media" on public.event_media;
create policy "collaborators see the event's media" on public.event_media for select
  using (public.is_collaborator('event', event_id));

-- 5. Editing, for collaborators given edit rights.
drop policy if exists "editors update the trip" on public.country_visits;
create policy "editors update the trip" on public.country_visits for update
  using (public.can_edit_as_collaborator('trip', id))
  with check (public.can_edit_as_collaborator('trip', id));

drop policy if exists "editors add places" on public.country_cities;
create policy "editors add places" on public.country_cities for insert
  with check (public.can_edit_as_collaborator('trip', country_visit_id));
drop policy if exists "editors change places" on public.country_cities;
create policy "editors change places" on public.country_cities for update
  using (public.can_edit_as_collaborator('trip', country_visit_id))
  with check (public.can_edit_as_collaborator('trip', country_visit_id));
drop policy if exists "editors remove places" on public.country_cities;
create policy "editors remove places" on public.country_cities for delete
  using (public.can_edit_as_collaborator('trip', country_visit_id));

drop policy if exists "editors add trip media" on public.country_media;
create policy "editors add trip media" on public.country_media for insert
  with check (public.can_edit_as_collaborator('trip', country_visit_id));
drop policy if exists "editors change trip media" on public.country_media;
create policy "editors change trip media" on public.country_media for update
  using (public.can_edit_as_collaborator('trip', country_visit_id))
  with check (public.can_edit_as_collaborator('trip', country_visit_id));
drop policy if exists "editors remove their own trip media" on public.country_media;
create policy "editors remove their own trip media" on public.country_media for delete
  using (added_by = auth.uid() and public.can_edit_as_collaborator('trip', country_visit_id));

drop policy if exists "editors update the event" on public.events;
create policy "editors update the event" on public.events for update
  using (public.can_edit_as_collaborator('event', id))
  with check (public.can_edit_as_collaborator('event', id));

drop policy if exists "editors add event media" on public.event_media;
create policy "editors add event media" on public.event_media for insert
  with check (public.can_edit_as_collaborator('event', event_id));
drop policy if exists "editors change event media" on public.event_media;
create policy "editors change event media" on public.event_media for update
  using (public.can_edit_as_collaborator('event', event_id))
  with check (public.can_edit_as_collaborator('event', event_id));
drop policy if exists "editors remove their own event media" on public.event_media;
create policy "editors remove their own event media" on public.event_media for delete
  using (added_by = auth.uid() and public.can_edit_as_collaborator('event', event_id));

-- Editors never change whose it is, who sees it, or whether it's in feeds.
create or replace function public.guard_collab_edits()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'events' then
    if auth.uid() is distinct from old.user_id then
      new.user_id := old.user_id;
      new.audience := old.audience;
      new.is_public := old.is_public;
      new.share_to_feed := old.share_to_feed;
      new.is_favourite := old.is_favourite;
    end if;
  elsif not public.owns_visited_country(old.visited_country_id) then
    new.visited_country_id := old.visited_country_id;
    new.audience := old.audience;
    new.is_public := old.is_public;
    new.show_in_feed := old.show_in_feed;
  end if;
  return new;
end;
$$;

drop trigger if exists events_zz_collab_guard on public.events;
create trigger events_zz_collab_guard before update on public.events
  for each row execute function public.guard_collab_edits();
drop trigger if exists country_visits_zz_collab_guard on public.country_visits;
create trigger country_visits_zz_collab_guard before update on public.country_visits
  for each row execute function public.guard_collab_edits();

-- A trip or event deleted: its collaborators go with it.
create or replace function public.collab_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.post_collaborators where kind = tg_argv[0] and target_id = old.id;
  delete from public.notifications where kind in ('collab_invite', 'collab_accepted') and target_kind = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists country_visits_collab_cleanup on public.country_visits;
create trigger country_visits_collab_cleanup after delete on public.country_visits
  for each row execute function public.collab_cleanup('trip');
drop trigger if exists events_collab_cleanup on public.events;
create trigger events_collab_cleanup after delete on public.events
  for each row execute function public.collab_cleanup('event');

-- 6. Notifications: "Mark invited you to a trip", "Melody accepted".
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'question', 'answer', 'invite_joined', 'collab_invite', 'collab_accepted'));
alter table public.notifications drop constraint if exists notifications_target_kind_check;
alter table public.notifications add constraint notifications_target_kind_check
  check (target_kind in ('country', 'event', 'question', 'trip'));

-- 7. What people do.
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
  select count(*) into n from public.post_collaborators where kind = p_kind and target_id = p_target;
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
  -- The invitation has been answered either way.
  update public.notifications set read = true
  where user_id = auth.uid() and kind = 'collab_invite' and target_id = r.target_id;
  if not p_accept then
    delete from public.post_collaborators where id = p_id;
    return 'declined';
  end if;
  if r.status = 'accepted' then return 'ok'; end if;
  update public.post_collaborators set status = 'accepted', responded_at = now() where id = p_id;
  -- A shared trip puts its country on your map as well.
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

create or replace function public.set_collab_edit(p_id uuid, p_can_edit boolean)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  update public.post_collaborators set can_edit = p_can_edit where id = p_id and owner_id = auth.uid();
  return case when found then 'ok' else 'not_found' end;
end;
$$;

-- The owner removes someone, or someone leaves: the post stays for everyone else.
create or replace function public.remove_collab(p_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  r public.post_collaborators;
begin
  select * into r from public.post_collaborators where id = p_id and (owner_id = auth.uid() or user_id = auth.uid());
  if not found then return 'not_found'; end if;
  delete from public.post_collaborators where id = p_id;
  delete from public.notifications where user_id = r.user_id and kind = 'collab_invite' and target_id = r.target_id;
  return 'ok';
end;
$$;

revoke all on function public.invite_collaborator(text, uuid, uuid) from public, anon;
revoke all on function public.respond_collab(uuid, boolean) from public, anon;
revoke all on function public.set_collab_edit(uuid, boolean) from public, anon;
revoke all on function public.remove_collab(uuid) from public, anon;
grant execute on function public.invite_collaborator(text, uuid, uuid) to authenticated;
grant execute on function public.respond_collab(uuid, boolean) to authenticated;
grant execute on function public.set_collab_edit(uuid, boolean) to authenticated;
grant execute on function public.remove_collab(uuid) to authenticated;

-- 8. A country on your map only because of a shared trip isn't posted to
--    feeds on its own (the shared trip is the post).
create or replace function public.country_in_feed(vc_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (
      select 1 from public.country_visits
      where visited_country_id = vc_id and show_in_feed and audience <> 'only_me'
    )
    or (
      not exists (select 1 from public.country_visits where visited_country_id = vc_id)
      and not exists (
        select 1
        from public.visited_countries me
        join public.post_collaborators pc on pc.user_id = me.user_id and pc.kind = 'trip' and pc.status = 'accepted'
        join public.country_visits v on v.id = pc.target_id
        join public.visited_countries o on o.id = v.visited_country_id and o.country_code = me.country_code
        where me.id = vc_id
      )
    );
$$;
