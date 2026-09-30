-- ExpandiaX is free for everyone. Everything Premium had is now everyone's:
-- no country or event limits, territories and US states for all, accent
-- colours for all, and the Premium photo/video allowance (15 photos and 8
-- videos per trip or event) as the one fair-use limit that keeps storage
-- affordable. Nobody is charged; the billing table stays, unused.

-- Photos and videos: 15 and 8 per trip, for everyone.
create or replace function public.enforce_country_media_cap()
returns trigger language plpgsql as $$
declare
  n int;
begin
  select count(*) into n from public.country_media
  where visited_country_id = new.visited_country_id
    and country_visit_id is not distinct from new.country_visit_id
    and media_type = new.media_type;

  if new.media_type = 'image' and n >= 15 then
    raise exception 'A trip can have at most 15 photos.';
  elsif new.media_type = 'video' and n >= 8 then
    raise exception 'A trip can have at most 8 videos.';
  end if;
  return new;
end;
$$;

-- …and per event.
create or replace function public.enforce_event_media_cap()
returns trigger language plpgsql as $$
declare
  n int;
begin
  select count(*) into n from public.event_media
  where event_id = new.event_id and media_type = new.media_type;

  if new.media_type = 'image' and n >= 15 then
    raise exception 'An event can have at most 15 photos.';
  elsif new.media_type = 'video' and n >= 8 then
    raise exception 'An event can have at most 8 videos.';
  end if;
  return new;
end;
$$;

-- No limit on countries or events.
drop trigger if exists visited_countries_entry_cap on public.visited_countries;
drop function if exists public.enforce_country_entry_cap();
drop trigger if exists events_entry_cap on public.events;
drop function if exists public.enforce_event_entry_cap();

-- Accent colours for everyone.
drop trigger if exists profiles_accent_color_gate on public.profiles;
drop function if exists public.enforce_premium_accent_color();

-- Territories (Greenland, Gibraltar…) for everyone.
drop policy if exists "owner manages visited countries insert" on public.visited_countries;
create policy "owner manages visited countries insert"
  on public.visited_countries for insert
  with check (user_id = auth.uid());

-- US states for everyone.
drop policy if exists "premium owner inserts us states" on public.visited_us_states;
drop policy if exists "owner inserts us states" on public.visited_us_states;
create policy "owner inserts us states"
  on public.visited_us_states for insert
  with check (user_id = auth.uid());

-- No more "go Premium" notifications.
delete from public.notifications where kind = 'premium_upsell';
