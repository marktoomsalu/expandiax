-- ============================================================
-- Explore page performance: replace "pull up to 1000 rows and count in
-- JS" with a proper per-user aggregate computed in the database.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

create view public.public_country_counts
with (security_invoker = true) as
  select user_id, count(*) as country_count
  from public.visited_countries
  group by user_id;

grant select on public.public_country_counts to anon, authenticated;
