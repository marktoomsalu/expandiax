-- ============================================================
-- Unlock video support for country trips (previously image-only).
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

alter table public.country_media
  drop constraint if exists country_media_media_type_check,
  add constraint country_media_media_type_check check (media_type in ('image', 'video'));

create or replace function public.enforce_country_media_cap()
returns trigger language plpgsql as $$
declare
  user_plan text;
  photo_cap int;
  video_cap int;
  n int;
begin
  select p.plan into user_plan
  from public.visited_countries vc
  join public.profiles p on p.id = vc.user_id
  where vc.id = new.visited_country_id;

  photo_cap := case when user_plan = 'premium' then 15 else 5 end;
  video_cap := case when user_plan = 'premium' then 8 else 3 end;

  select count(*) into n from public.country_media
  where visited_country_id = new.visited_country_id
    and country_visit_id is not distinct from new.country_visit_id
    and media_type = new.media_type;

  if new.media_type = 'image' and n >= photo_cap then
    raise exception 'A trip can have at most % photos.', photo_cap;
  elsif new.media_type = 'video' and n >= video_cap then
    raise exception 'A trip can have at most % videos.', video_cap;
  end if;
  return new;
end;
$$;
