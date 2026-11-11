-- ============================================================
-- Invite links: expandiax.com/join/<username>.
--
--   invites   who brought whom: one row per new member (the friend whose
--             link they joined through). Counts towards the inviter's
--             "Connector" badge (5 friends who made an account).
--   accept_invite(username)   called once by the new member right after
--             signing up: records the invite and makes them follow each
--             other (straight away, even if either account is private:
--             the invite is the consent). Only for accounts made in the
--             last 14 days, only once, never yourself.
--   The inviter gets one notification, "joined with your invite"
--   (invite_joined), instead of two "started following you".
-- ============================================================

create table if not exists public.invites (
  invitee_id uuid primary key references public.profiles (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index if not exists invites_inviter_idx on public.invites (inviter_id, created_at desc);

alter table public.invites enable row level security;
drop policy if exists "invites: yours" on public.invites;
create policy "invites: yours" on public.invites for select
  using (inviter_id = auth.uid() or invitee_id = auth.uid());
grant select on public.invites to authenticated;
-- Counts are public (the badge shows on profiles); names aren't.
create or replace function public.invite_count(p_user uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.invites where inviter_id = p_user;
$$;
grant execute on function public.invite_count(uuid) to anon, authenticated;

-- The new notification kind.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'question', 'answer', 'invite_joined'));

-- "Started following you", unless an invite is connecting the two (then
-- invite_joined says it instead).
create or replace function public.notify_on_follow()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(current_setting('expandiax.invite_follow', true), '') = 'on' then
    return new;
  end if;
  insert into public.notifications (user_id, actor_id, kind)
  values (new.followee_id, new.follower_id, 'follow');
  return new;
end;
$$;

create or replace function public.accept_invite(p_inviter text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  inviter uuid;
  joined timestamptz;
begin
  if me is null then return 'signed_out'; end if;
  select id into inviter from public.profiles where lower(username) = lower(trim(p_inviter));
  if inviter is null then return 'unknown'; end if;
  if inviter = me then return 'self'; end if;
  if exists (select 1 from public.invites where invitee_id = me) then return 'already'; end if;
  select created_at into joined from public.profiles where id = me;
  if joined is not null and joined < now() - interval '14 days' then return 'too_late'; end if;
  -- Someone who blocked the other: no connection.
  if exists (select 1 from public.blocks where (blocker_id = me and blocked_id = inviter) or (blocker_id = inviter and blocked_id = me)) then
    return 'blocked';
  end if;

  insert into public.invites (invitee_id, inviter_id) values (me, inviter);
  perform set_config('expandiax.invite_follow', 'on', true);
  insert into public.follows (follower_id, followee_id) values (me, inviter) on conflict do nothing;
  insert into public.follows (follower_id, followee_id) values (inviter, me) on conflict do nothing;
  perform set_config('expandiax.invite_follow', '', true);
  delete from public.follow_requests where (requester_id = me and target_id = inviter) or (requester_id = inviter and target_id = me);
  insert into public.notifications (user_id, actor_id, kind) values (inviter, me, 'invite_joined');
  return 'ok';
end;
$$;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Its push words (the admin panel can change them).
insert into public.push_templates (kind, title, body) values
  ('invite_joined', 'Your invite worked 🎉', '{name} joined ExpandiaX. You now follow each other.')
on conflict (kind) do nothing;
