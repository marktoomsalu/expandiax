-- ============================================================
-- Share to ExpandiaX (iPhone Share button, build 19 on).
--
-- The share sheet runs apart from the app, so it can't use the app's own
-- sign-in (refreshing it from two places would sign the app out). Instead
-- the app gets a share key once, kept in the phone's keychain where the
-- share sheet can read it. Only a hash is stored here; the key itself
-- never is. Signing out removes it; so does deleting the account.
--
-- Only the server (service role) reads or writes this table: no policies.
-- ============================================================

create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists share_tokens_user_idx on public.share_tokens (user_id);

alter table public.share_tokens enable row level security;
