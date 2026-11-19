-- 084: partner placements, managed from the admin space (/admin/partners)
-- instead of being written into the code.
--
-- Two kinds, as before (src/lib/sponsors.ts):
--   event  a partner's event, featured on Explore ("On your radar") for the
--          people it targets: home country or dream list in its audience,
--          or everyone when the audience is empty. Shown until its day.
--   place  a partner card on a country's page (a tourism board's guide, a
--          hotel's offer).
-- Each runs from starts_on to until (both optional, inclusive) while active.
-- views and clicks are counted by the server, for the partner's report.
--
-- Members only ever read placements that are running; only the server
-- (service role, after checking the admins table) writes them.

create table if not exists public.partner_placements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event', 'place')),
  partner text not null check (length(trim(partner)) between 1 and 80),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  url text not null check (url ~ '^https://' and length(url) <= 1000),
  image_url text check (image_url is null or (image_url ~ '^https://' and length(image_url) <= 1000)),
  -- an event
  name text check (name is null or length(name) <= 120),
  event_date date,
  venue text check (venue is null or length(venue) <= 120),
  city text check (city is null or length(city) <= 80),
  audience text[] not null default '{}',
  -- a place card
  title text check (title is null or length(title) <= 120),
  body text check (body is null or length(body) <= 400),
  cta text check (cta is null or length(cta) <= 40),
  -- when and whether it runs
  starts_on date,
  until date,
  active boolean not null default true,
  views integer not null default 0,
  clicks integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'event' or (name is not null and event_date is not null)),
  check (kind <> 'place' or (title is not null and body is not null and cta is not null))
);

create index if not exists partner_placements_running on public.partner_placements (kind, country_code) where active;

alter table public.partner_placements enable row level security;

drop policy if exists "partner placements: running ones" on public.partner_placements;
create policy "partner placements: running ones" on public.partner_placements for select
  using (active and (starts_on is null or starts_on <= current_date) and (until is null or until >= current_date));

grant select on public.partner_placements to anon, authenticated;

-- Counting a view or a click: one row, one number, from the server.
create or replace function public.count_partner_placement(p_id uuid, p_what text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.partner_placements
     set views = views + case when p_what = 'view' then 1 else 0 end,
         clicks = clicks + case when p_what = 'click' then 1 else 0 end
   where id = p_id;
$$;

revoke all on function public.count_partner_placement(uuid, text) from public, anon, authenticated;
grant execute on function public.count_partner_placement(uuid, text) to service_role;

-- Pictures for placements: public (they're adverts), uploaded only by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-media', 'partner-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
