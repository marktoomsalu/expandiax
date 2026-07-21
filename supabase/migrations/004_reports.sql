-- ============================================================
-- Content reporting. Write-only from the app's side for now — there's no
-- admin UI yet, so review submissions via the Table Editor
-- (Table Editor -> reports) until one exists.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'concert', 'country')),
  target_id uuid not null,
  target_url text not null,
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

create index reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

create policy "users file reports" on public.reports for insert
  with check (reporter_id = auth.uid());
