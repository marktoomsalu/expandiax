-- ============================================================
-- "Suggested for you": people someone tapped × on are never suggested to
-- them again. Only they can see or change their own list.
-- ============================================================

create table if not exists public.suggestion_dismissals (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  dismissed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dismissed_id)
);

alter table public.suggestion_dismissals enable row level security;
drop policy if exists "dismissals: your own" on public.suggestion_dismissals;
create policy "dismissals: your own" on public.suggestion_dismissals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, delete on public.suggestion_dismissals to authenticated;
