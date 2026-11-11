-- ============================================================
-- Invite links opened on an iPhone go straight to the App Store, which
-- passes nothing on. So the friend is still connected after installing, the
-- click is kept for a day as a fingerprint: a one-way hash of the network
-- address and iOS version (never the address itself). Signing up on the
-- same network soon after claims it; then it's deleted, and anything older
-- than a day is deleted anyway. Only the server reads or writes this.
-- ============================================================

create table if not exists public.invite_clicks (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null check (length(fingerprint) = 64),
  created_at timestamptz not null default now()
);
create index if not exists invite_clicks_fp_idx on public.invite_clicks (fingerprint, created_at desc);
alter table public.invite_clicks enable row level security;
