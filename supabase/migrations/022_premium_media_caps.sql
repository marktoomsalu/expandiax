-- ============================================================
-- Raises photo/video caps for Premium: 5 -> 15 photos, 3 -> 8 videos.
-- Both cap triggers now look up the uploader's plan via profiles.plan
-- (the cheap, publicly-readable copy synced from billing.plan) rather
-- than a fixed number.
-- ============================================================

create or replace function public.enforce_country_media_cap()
returns trigger language plpgsql as $$
declare
  user_plan text;
  cap int;
begin
  select p.plan into user_plan
  from public.visited_countries vc
  join public.profiles p on p.id = vc.user_id
  where vc.id = new.visited_country_id;

  cap := case when user_plan = 'premium' then 15 else 5 end;

  if (select count(*) from public.country_media
      where visited_country_id = new.visited_country_id
      and country_visit_id is not distinct from new.country_visit_id) >= cap then
    raise exception 'A trip can have at most % photos.', cap;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_event_media_cap()
returns trigger language plpgsql as $$
declare
  user_plan text;
  photo_cap int;
  video_cap int;
  n int;
begin
  select p.plan into user_plan
  from public.events e
  join public.profiles p on p.id = e.user_id
  where e.id = new.event_id;

  photo_cap := case when user_plan = 'premium' then 15 else 5 end;
  video_cap := case when user_plan = 'premium' then 8 else 3 end;

  select count(*) into n from public.event_media
  where event_id = new.event_id and media_type = new.media_type;

  if new.media_type = 'image' and n >= photo_cap then
    raise exception 'An event can have at most % photos.', photo_cap;
  end if;
  if new.media_type = 'video' and n >= video_cap then
    raise exception 'An event can have at most % videos.', video_cap;
  end if;
  return new;
end;
$$;
