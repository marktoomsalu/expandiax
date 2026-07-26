-- ============================================================
-- Move cities from the general country level to a specific visit,
-- matching photos/notes/soundtrack (retired in 028) — a city belongs
-- to the trip you visited it on, not the country as a whole.
--
-- Existing cities are preserved by folding them into a visit, not
-- deleted: the country's most recent visit, or (if it somehow has no
-- visits yet) a freshly created one dated from when the country was
-- first added — same pattern as 028.
-- ============================================================

-- 1. Create a landing visit for any country that has cities but zero
--    visits yet (should be rare post-028, but a safety net).
insert into public.country_visits (visited_country_id, year, date_precision, highlight)
select vc.id, extract(year from vc.created_at)::int, 'year', ''
from public.visited_countries vc
where exists (select 1 from public.country_cities cc where cc.visited_country_id = vc.id)
  and not exists (select 1 from public.country_visits cv where cv.visited_country_id = vc.id);

-- 2. Add the column (nullable for now, so we can backfill first).
alter table public.country_cities add column country_visit_id uuid references public.country_visits (id) on delete cascade;

-- 3. Backfill: assign every existing city to its country's most recent visit.
with target as (
  select distinct on (cc.visited_country_id) cc.visited_country_id as country_id, cv.id as visit_id
  from public.country_cities cc
  join public.country_visits cv on cv.visited_country_id = cc.visited_country_id
  order by cc.visited_country_id, coalesce(cv.visited_to, cv.visited_from, make_date(cv.year, 12, 31)) desc
)
update public.country_cities cc
set country_visit_id = t.visit_id
from target t
where cc.visited_country_id = t.country_id;

-- 4. Require it going forward.
alter table public.country_cities alter column country_visit_id set not null;
