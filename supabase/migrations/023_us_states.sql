-- ============================================================
-- US States tracking — a lighter, separate map alongside the world
-- map (50 states + DC). Premium-only: gated both in the UI and here
-- at the insert policy, so the real boundary isn't just client-side.
-- Deliberately kept simple for v1 — no visits/photos/soundtrack, just
-- visited + an optional note, mirroring how country tracking started.
-- ============================================================

create table public.visited_us_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  state_name text not null,
  note text not null default '' check (length(note) <= 500),
  is_favourite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, state_code)
);

create index visited_us_states_user_idx on public.visited_us_states (user_id);

create trigger visited_us_states_touch before update on public.visited_us_states
  for each row execute function public.set_updated_at();

alter table public.visited_us_states enable row level security;

create policy "us states readable when owner or profile public"
  on public.visited_us_states for select
  using (user_id = auth.uid() or public.is_profile_public(user_id));

create policy "premium owner inserts us states"
  on public.visited_us_states for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and plan = 'premium')
  );

create policy "owner updates us states"
  on public.visited_us_states for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner deletes us states"
  on public.visited_us_states for delete
  using (user_id = auth.uid());
