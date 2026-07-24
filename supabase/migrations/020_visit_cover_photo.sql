-- ============================================================
-- Lets a trip have its own cover photo, the same way a country
-- already can — pick which of a trip's photos represents it.
-- ============================================================

alter table public.country_visits
  add column cover_media_id uuid references public.country_media (id) on delete set null;
