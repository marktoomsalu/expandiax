-- ============================================================
-- A new notification kind for the monthly Premium upsell nudge, sent by
-- a cron job (not a trigger, since it's time-based rather than reacting to
-- another user's action) — see src/app/api/cron/premium-upsell/route.ts.
-- ============================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'premium_upsell'));
