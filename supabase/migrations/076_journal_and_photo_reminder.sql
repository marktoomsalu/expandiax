-- 076: a private journal for each trip, and countries you don't mean to add
-- photos to.
--
-- 1. visited_countries.photo_reminder_off: "Not adding photos" on My World's
--    "waiting for your photos" list. Not every country needs photos; once
--    it's off, that country isn't on the list any more.
-- 2. trip_journals: longer writing about a trip or a stay, for yourself.
--    One per person per trip (so everyone on a shared trip keeps their own).
--    Private unless its writer shares it; a shared journal is readable by
--    whoever can see the trip itself (the trip's own rules decide, because
--    the check reads country_visits as the viewer).

alter table public.visited_countries
  add column if not exists photo_reminder_off boolean not null default false;

create table if not exists public.trip_journals (
  visit_id uuid not null references public.country_visits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  is_shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (visit_id, user_id)
);

alter table public.trip_journals enable row level security;

drop policy if exists "journals: your own, or shared on a trip you can see" on public.trip_journals;
create policy "journals: your own, or shared on a trip you can see" on public.trip_journals for select
  using (
    user_id = auth.uid()
    or (is_shared and exists (select 1 from public.country_visits v where v.id = visit_id))
  );

-- You write your own, and only on a trip that's yours or shared with you.
drop policy if exists "journals: write your own" on public.trip_journals;
create policy "journals: write your own" on public.trip_journals for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.country_visits v
        join public.visited_countries c on c.id = v.visited_country_id
        where v.id = visit_id and c.user_id = auth.uid()
      )
      or public.is_collaborator('trip', visit_id)
    )
  );

drop policy if exists "journals: change your own" on public.trip_journals;
create policy "journals: change your own" on public.trip_journals for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "journals: delete your own" on public.trip_journals;
create policy "journals: delete your own" on public.trip_journals for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.trip_journals to authenticated;
grant select on public.trip_journals to anon;
