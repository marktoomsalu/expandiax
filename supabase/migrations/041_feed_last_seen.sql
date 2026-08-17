-- ============================================================
-- Adds profiles.feed_last_seen_at, so /feed can tell which posts are new
-- since the viewer's last visit and show a "You're all caught up" marker
-- between new and already-seen posts (or at the very top, if nothing's
-- new at all) — same pattern already used for notifications.read, just
-- a single timestamp instead of a per-row flag, since the feed is a
-- single reverse-chronological stream rather than discrete items to
-- mark individually.
--
-- No RLS change needed: profiles' existing "users update own profile"
-- policy already covers writing this column on your own row.
-- ============================================================

alter table public.profiles add column feed_last_seen_at timestamptz;
