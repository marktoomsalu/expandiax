-- ============================================================
-- Connect a concert's "favourite song" to an actual Spotify track,
-- so it can be played back (via Spotify's embed widget) instead of
-- just being a typed-in title. The `highlight` column already holds
-- the display name (kept in sync when picked via Spotify); this just
-- adds the track id needed to embed it.
-- ============================================================

alter table public.events
  add column spotify_favourite_track_id text;
