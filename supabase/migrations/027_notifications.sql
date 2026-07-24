-- ============================================================
-- In-app notifications for likes, comments, and follows.
--
-- Rows are written exclusively by security-definer trigger functions
-- attached to likes/comments/follows — there is deliberately no insert
-- policy for regular users, so the app can only ever read and mark its
-- own notifications as read.
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'follow')),
  target_kind text check (target_kind in ('country', 'event')),
  target_id uuid,
  comment_body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where not read;

alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications for select
  using (user_id = auth.uid());

create policy "users mark own notifications read" on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.notify_on_like()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  owner_id uuid;
begin
  if new.kind = 'country' then
    select user_id into owner_id from public.visited_countries where id = new.target_id;
  else
    select user_id into owner_id from public.events where id = new.target_id;
  end if;

  if owner_id is not null and owner_id != new.user_id then
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id)
    values (owner_id, new.user_id, 'like', new.kind, new.target_id);
  end if;
  return new;
end;
$$;

create trigger likes_notify after insert on public.likes
  for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  owner_id uuid;
begin
  if new.kind = 'country' then
    select user_id into owner_id from public.visited_countries where id = new.target_id;
  else
    select user_id into owner_id from public.events where id = new.target_id;
  end if;

  if owner_id is not null and owner_id != new.user_id then
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id, comment_body)
    values (owner_id, new.user_id, 'comment', new.kind, new.target_id, new.body);
  end if;
  return new;
end;
$$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_follow()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
  values (new.followee_id, new.follower_id, 'follow');
  return new;
end;
$$;

create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_on_follow();
