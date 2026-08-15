-- ============================================================
-- Adds Azores, Madeira, and Canary Islands as territories — the one
-- case in the list with no ISO 3166-1 code at all (they're just
-- Portugal/Spain internally, no country-level identity of their own).
-- Identified instead by their ISO 3166-2 subdivision codes (PT-20,
-- PT-30, ES-CN), which needs both check constraints below loosened to
-- accept an optional "-XXX" suffix. Doesn't touch the 195 countries or
-- the 36 existing plain-alpha-2 territories at all — the base
-- "^[A-Z]{2}" shape is unchanged, just no longer required to be the
-- *entire* string. events.country_code is untouched on purpose: events
-- only ever target the 195 countries (EventForm's <select> reads from
-- COUNTRIES, never TERRITORIES), so it doesn't need to accept this
-- shape at all.
--
-- None of the three have any shape in the app's low-res globe data
-- (checked directly: Portugal's and Spain's polygons are mainland-only,
-- nothing merged in the way French Guiana was inside France's), so like
-- most other territories they won't paint as visited on the map — but
-- are fully addable with photos and memories, same as any other.
-- ============================================================

alter table public.territories
  drop constraint territories_code_check,
  add constraint territories_code_check check (code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$');

alter table public.visited_countries
  drop constraint visited_countries_country_code_check,
  add constraint visited_countries_country_code_check check (country_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$');

insert into public.territories (code, name) values
  ('PT-20', 'Azores'), ('PT-30', 'Madeira'), ('ES-CN', 'Canary Islands');
