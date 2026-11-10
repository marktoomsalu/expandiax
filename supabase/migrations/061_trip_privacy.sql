-- ============================================================
-- Privacy per trip or stay, instead of per country.
--
-- A country always shows on your map and profile (to whoever can see
-- your profile); each trip or stay in it is "Visible" or "Only me". Five
-- trips to Italy, three of them visible: others see Italy and those three,
-- and none of the other two's places or photos.
--
-- The country-wide "Only me" (visited_countries.is_public, migration 047)
-- keeps working for the one country that uses it; the app no longer
-- offers it, only a way to show that country again.
-- ============================================================

alter table public.country_visits add column if not exists is_public boolean not null default true;

-- Whether others may see this trip: it's visible, and so is its country.
create or replace function public.country_visit_is_public(v_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.country_visits v
    where v.id = v_id and v.is_public and public.visited_country_is_public(v.visited_country_id)
  );
$$;

drop policy if exists "country visits readable" on public.country_visits;
create policy "country visits readable" on public.country_visits for select
  using (public.owns_visited_country(visited_country_id)
         or (is_public and public.visited_country_is_public(visited_country_id)));

-- A trip's places and photos go with it.
drop policy if exists "country cities readable" on public.country_cities;
create policy "country cities readable" on public.country_cities for select
  using (public.owns_visited_country(visited_country_id)
         or public.country_visit_is_public(country_visit_id));

drop policy if exists "country media readable" on public.country_media;
create policy "country media readable" on public.country_media for select
  using (public.owns_visited_country(visited_country_id)
         or public.country_visit_is_public(country_visit_id));

-- "How many travellers have been to this town" counts only visible trips.
create or replace function public.place_traveller_counts(p_country text)
returns table (place text, travellers bigint)
language sql stable security definer set search_path = public
as $$
  with seen as (
    select vc.id, vc.user_id
    from public.visited_countries vc
    join public.profiles p on p.id = vc.user_id
    where vc.country_code = upper(p_country)
      and vc.is_public
      and p.discoverable
      and (auth.uid() is null or not private.is_blocked_between(auth.uid(), vc.user_id))
  )
  select ''::text, count(distinct s.user_id) from seen s
  union all
  select min(trim(c.city_name)), count(distinct s.user_id)
  from seen s
  join public.country_cities c on c.visited_country_id = s.id
  join public.country_visits v on v.id = c.country_visit_id and v.is_public
  group by lower(trim(c.city_name));
$$;

-- World Connect: "lived here" only from stays you show.
create or replace function private.globe_touch_countries(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', vc.country_code,
    'lived', exists (select 1 from public.country_visits v where v.visited_country_id = vc.id and v.kind = 'lived' and v.is_public)
  ) order by vc.country_code), '[]'::jsonb)
  from public.visited_countries vc
  where vc.user_id = p_user and vc.is_public;
$$;

revoke all on function public.country_visit_is_public(uuid) from public;
grant execute on function public.country_visit_is_public(uuid) to anon, authenticated;
