-- ============================================================
-- World Connect, remembered: who you've connected with (each pair once).
-- globe_touches keeps a touch for a day only; this keeps the fact, for the
-- "Worlds Collide" badge. Written by a trigger when both phones of a touch
-- have reported it, so the World Connect functions don't change.
-- ============================================================

create table if not exists public.world_connects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  peer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, peer_id),
  check (user_id <> peer_id)
);
alter table public.world_connects enable row level security;
drop policy if exists "world connects: yours" on public.world_connects;
create policy "world connects: yours" on public.world_connects for select using (user_id = auth.uid());
grant select on public.world_connects to authenticated;

create or replace function private.remember_world_connect()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  other uuid;
begin
  select t.user_id into other
  from public.globe_touches t
  where t.code = new.peer_code and t.peer_code = new.code and t.user_id <> new.user_id
    and abs(extract(epoch from t.created_at - new.created_at)) < 120
  limit 1;
  if other is not null then
    insert into public.world_connects (user_id, peer_id) values (new.user_id, other), (other, new.user_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists globe_touches_remember on public.globe_touches;
create trigger globe_touches_remember after insert on public.globe_touches
  for each row execute function private.remember_world_connect();

-- How many people someone has connected with (badges show on profiles, so
-- the number is public; who isn't).
create or replace function public.world_connect_count(p_user uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.world_connects where user_id = p_user;
$$;
grant execute on function public.world_connect_count(uuid) to anon, authenticated;
