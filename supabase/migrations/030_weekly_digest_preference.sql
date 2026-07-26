-- ============================================================
-- Opt-out preference for the weekly digest email (cron job).
-- Defaults to on; existing users get it without needing to do anything,
-- but can turn it off from Settings.
-- ============================================================

alter table public.profiles add column weekly_digest_enabled boolean not null default true;
