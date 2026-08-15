-- ============================================================
-- Redesign: territories now live directly in visited_countries (same
-- table as the 195 recognised countries), reusing all of its existing
-- infrastructure — photos, notes, visits, the /my-world/[code] page —
-- instead of a separate, simpler table. Gated behind Premium at the
-- insert policy here, and excluded from TOTAL_COUNTRIES-based stats in
-- app code (never at the database level, since visited_countries has no
-- concept of "doesn't count").
--
-- `territories` below is a plain reference table (just code + name) so
-- this policy can check "is this code a territory" without embedding a
-- 36-item array directly in SQL. Kept in sync by hand with
-- src/lib/territories.ts — if that list ever changes, this table needs
-- updating too.
--
-- DESTRUCTIVE: drops the visited_territories table from the previous
-- (now abandoned) separate-table approach. Only run this if you're fine
-- losing any rows already in it — this app is pre-launch, so that should
-- just be your own test data, but worth pausing on before running.
-- ============================================================

create table public.territories (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null
);

insert into public.territories (code, name) values
  ('AQ', 'Antarctica'), ('GL', 'Greenland'), ('SJ', 'Svalbard and Jan Mayen'),
  ('FO', 'Faroe Islands'), ('GI', 'Gibraltar'), ('IM', 'Isle of Man'), ('JE', 'Jersey'), ('GG', 'Guernsey'), ('AX', 'Åland Islands'),
  ('HK', 'Hong Kong'), ('MO', 'Macau'),
  ('PR', 'Puerto Rico'), ('VI', 'US Virgin Islands'), ('VG', 'British Virgin Islands'), ('KY', 'Cayman Islands'), ('BM', 'Bermuda'),
  ('AW', 'Aruba'), ('CW', 'Curaçao'), ('SX', 'Sint Maarten'), ('TC', 'Turks and Caicos Islands'), ('AI', 'Anguilla'), ('MS', 'Montserrat'), ('GP', 'Guadeloupe'), ('MQ', 'Martinique'),
  ('GU', 'Guam'), ('AS', 'American Samoa'), ('MP', 'Northern Mariana Islands'), ('PF', 'French Polynesia'), ('NC', 'New Caledonia'), ('CK', 'Cook Islands'), ('NU', 'Niue'),
  ('GF', 'French Guiana'), ('RE', 'Réunion'), ('YT', 'Mayotte'), ('FK', 'Falkland Islands'), ('SH', 'Saint Helena');

alter table public.territories enable row level security;

create policy "territories reference data is public" on public.territories for select using (true);

-- Replaces the plain "owner inserts" policy with one that also requires
-- Premium when the code being inserted is a territory. Regular countries
-- are completely unaffected (the `not exists` branch short-circuits true
-- for any code not in the territories table).
drop policy if exists "owner manages visited countries insert" on public.visited_countries;

create policy "owner manages visited countries insert"
  on public.visited_countries for insert
  with check (
    user_id = auth.uid()
    and (
      not exists (select 1 from public.territories where code = country_code)
      or exists (select 1 from public.profiles where id = auth.uid() and plan = 'premium')
    )
  );

drop table if exists public.visited_territories;
