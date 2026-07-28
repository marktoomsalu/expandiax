-- ============================================================
-- Device push tokens, registered by the native iOS/Android app
-- (Capacitor + @capacitor/push-notifications) so the notifications
-- trigger pipeline can dispatch real push notifications, not just
-- in-app rows. Users manage their own tokens; nothing else reads
-- or writes this table directly except the push-send API route
-- (via the service-role client).
-- ============================================================

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

create policy "users manage own device tokens" on public.device_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger device_tokens_touch before update on public.device_tokens
  for each row execute function public.set_updated_at();
