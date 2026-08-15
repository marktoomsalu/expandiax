-- ============================================================
-- Private profiles become discoverable (searchable in Explore) and
-- followable via a request/approval flow, instead of being functionally
-- invisible. Public/friends profiles are unaffected — they still follow
-- directly, no request needed; "friends" visibility still unlocks via
-- mutual follow as before. Only "private" changes: it now means
-- "approved followers only" instead of "nobody, ever".
-- ============================================================

create table public.follow_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  check (requester_id <> target_id)
);

create index follow_requests_target_idx on public.follow_requests (target_id);

alter table public.follow_requests enable row level security;

create policy "users see own follow requests" on public.follow_requests for select
  using (requester_id = auth.uid() or target_id = auth.uid());

create policy "users request to follow private profiles" on public.follow_requests for insert
  with check (
    requester_id = auth.uid()
    and (select visibility from public.profiles where id = target_id) = 'private'
    and not exists (
      select 1 from public.follows where follower_id = auth.uid() and followee_id = target_id
    )
  );

create policy "users cancel or decline follow requests" on public.follow_requests for delete
  using (requester_id = auth.uid() or target_id = auth.uid());

-- Private profiles' content is now visible to accepted followers, not just
-- nobody — the "private" branch previously always returned false.
create or replace function public.is_profile_public(profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case (select visibility from public.profiles where id = profile_id)
    when 'public' then true
    when 'friends' then public.is_mutual_follow(auth.uid(), profile_id)
    when 'private' then exists (
      select 1 from public.follows where follower_id = auth.uid() and followee_id = profile_id
    )
    else false
  end;
$$;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted'));

create or replace function public.notify_on_follow_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
  values (new.target_id, new.requester_id, 'follow_request');
  return new;
end;
$$;

create trigger follow_requests_notify after insert on public.follow_requests
  for each row execute function public.notify_on_follow_request();

-- Callable only by the request's target (via auth.uid()) — accepts by
-- creating the actual follows row, notifies the requester, and clears the
-- request. security_invoker's default RLS on `follows` would otherwise
-- block this insert (profile_allows_follow rejects private targets, since
-- that direct path is meant to stay closed off), which is exactly the
-- point: this function is the only door into a private profile's follows.
create or replace function public.accept_follow_request(p_requester_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_target uuid := auth.uid();
begin
  if not exists (
    select 1 from public.follow_requests
    where requester_id = p_requester_id and target_id = v_target
  ) then
    raise exception 'No such follow request';
  end if;

  insert into public.follows (follower_id, followee_id)
  values (p_requester_id, v_target)
  on conflict do nothing;

  insert into public.notifications (user_id, actor_id, kind)
  values (p_requester_id, v_target, 'follow_accepted');

  delete from public.follow_requests
  where requester_id = p_requester_id and target_id = v_target;
end;
$$;

grant execute on function public.accept_follow_request(uuid) to authenticated;

-- Search/discovery: any signed-in user can find any profile's basic info
-- (name, avatar, bio) regardless of visibility, so private accounts can
-- actually be found and requested. Their trip/event content stays gated by
-- the separate, unaffected content-table policies above. Anonymous
-- visitors are unaffected (no `to authenticated` scope on the original
-- policy), so the logged-out/pre-signin explore experience doesn't change.
create policy "authenticated users can discover any profile"
  on public.profiles for select
  to authenticated
  using (true);
