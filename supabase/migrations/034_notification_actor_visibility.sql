-- ============================================================
-- Notifications showed "Someone" with a blank avatar for any actor whose
-- profile isn't public/mutual-friends with the recipient — the
-- profiles-select RLS policy hid the row entirely, so the join in
-- notifications/page.tsx came back null. Someone liking/commenting/
-- following you is an action taken on your own content; knowing who did
-- it is different from being able to browse their profile/trips, which
-- stay exactly as protected as before (this only affects the `profiles`
-- table's own row, not visited_countries/events/media, which each have
-- their own separate visibility-gated policies).
-- ============================================================

create policy "notified users can see the actor's profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.notifications
      where notifications.actor_id = profiles.id
        and notifications.user_id = auth.uid()
    )
  );
