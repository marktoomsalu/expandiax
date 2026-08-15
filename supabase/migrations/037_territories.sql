-- ============================================================
-- Special territories tracking (Greenland, Gibraltar, Hong Kong, etc.) —
-- mirrors 023_us_states.sql exactly: a lighter, separate table alongside
-- the world map, Premium-only, deliberately kept simple for v1 (no
-- visits/photos, just visited + an optional note). Doesn't touch
-- visited_countries or TOTAL_COUNTRIES at all — territories are tracked
-- and counted entirely separately from the 195 recognised countries.
-- ============================================================

create table public.visited_territories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  territory_code text not null check (territory_code ~ '^[A-Z]{2}$'),
  territory_name text not null,
  note text not null default '' check (length(note) <= 500),
  is_favourite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, territory_code)
);

create index visited_territories_user_idx on public.visited_territories (user_id);

create trigger visited_territories_touch before update on public.visited_territories
  for each row execute function public.set_updated_at();

alter table public.visited_territories enable row level security;

create policy "territories readable when owner or profile public"
  on public.visited_territories for select
  using (user_id = auth.uid() or public.is_profile_public(user_id));

create policy "premium owner inserts territories"
  on public.visited_territories for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and plan = 'premium')
  );

create policy "owner updates territories"
  on public.visited_territories for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner deletes territories"
  on public.visited_territories for delete
  using (user_id = auth.uid());
