-- ============================================================
-- ExpandiaX — demonstration data for one fictional profile
--
-- HOW TO USE
-- 1. Run schema.sql first.
-- 2. In the app (or Supabase Auth dashboard) create a user with
--    email demo@atlasencore.example and any password. When signing
--    up through the app, use username `liiskask`.
--    (The on_auth_user_created trigger creates the profile row.)
-- 3. Replace DEMO_USER_ID below with that user's auth UUID, or run
--    as-is: the DO block finds the user by email automatically.
-- 4. Run this file in the Supabase SQL editor.
--
-- Media note: seed rows use https://picsum.photos placeholder
-- images (freely usable Unsplash-sourced placeholders) so the demo
-- profile looks alive without redistributing copyrighted photos.
-- Uploads from real users go to Supabase Storage as usual.
-- ============================================================

do $$
declare
  uid uuid;
  vc_ee uuid; vc_es uuid; vc_it uuid; vc_pl uuid; vc_fi uuid;
  m1 uuid; m2 uuid; m3 uuid;
  e_madrid uuid; e_tallinn uuid; e_helsinki uuid;
  em1 uuid; em2 uuid; em3 uuid;
begin
  select id into uid from auth.users where email = 'demo@atlasencore.example';
  if uid is null then
    raise exception 'Create a user with email demo@atlasencore.example first (see instructions at the top of this file).';
  end if;

  update public.profiles set
    username = 'liiskask',
    display_name = 'Liis Kask',
    bio = 'Island girl from Saaremaa collecting coastlines and encores. I travel for the light and stay for the music.',
    home_country_code = 'EE',
    visibility = 'public'
  where id = uid;

  -- Countries -------------------------------------------------
  insert into public.visited_countries (user_id, country_code, country_name, note, is_favourite)
  values (uid, 'EE', 'Estonia', 'Home. Juniper, sea wind, and the June light over Saaremaa that never quite leaves.', true)
  returning id into vc_ee;
  insert into public.country_visits (visited_country_id, year) values (vc_ee, 2022), (vc_ee, 2023), (vc_ee, 2024);
  insert into public.country_cities (visited_country_id, city_name) values (vc_ee, 'Tallinn'), (vc_ee, 'Kuressaare'), (vc_ee, 'Tartu');
  insert into public.country_media (visited_country_id, storage_path, public_url, caption, display_order)
  values (vc_ee, 'seed/ee-1', 'https://picsum.photos/seed/atlas-ee1/1200/800', 'Baltic dusk', 0)
  returning id into m1;
  insert into public.country_media (visited_country_id, storage_path, public_url, caption, display_order)
  values (vc_ee, 'seed/ee-2', 'https://picsum.photos/seed/atlas-ee2/1200/800', 'Old town rooftops', 1);
  update public.visited_countries set cover_media_id = m1 where id = vc_ee;

  insert into public.visited_countries (user_id, country_code, country_name, note, is_favourite)
  values (uid, 'ES', 'Spain', 'Madrid in late August: rooftop nights, cold vermut, and a stadium that sang louder than the band.', true)
  returning id into vc_es;
  insert into public.country_visits (visited_country_id, year) values (vc_es, 2023);
  insert into public.country_cities (visited_country_id, city_name) values (vc_es, 'Madrid'), (vc_es, 'Toledo');
  insert into public.country_media (visited_country_id, storage_path, public_url, caption, display_order)
  values (vc_es, 'seed/es-1', 'https://picsum.photos/seed/atlas-es1/1200/800', 'Golden hour, Gran Vía', 0)
  returning id into m2;
  update public.visited_countries set cover_media_id = m2 where id = vc_es;

  insert into public.visited_countries (user_id, country_code, country_name, note)
  values (uid, 'IT', 'Italy', 'Espresso standing up, trains slightly late, every wall a museum.')
  returning id into vc_it;
  insert into public.country_visits (visited_country_id, year) values (vc_it, 2022);
  insert into public.country_cities (visited_country_id, city_name) values (vc_it, 'Rome'), (vc_it, 'Florence');
  insert into public.country_media (visited_country_id, storage_path, public_url, caption, display_order)
  values (vc_it, 'seed/it-1', 'https://picsum.photos/seed/atlas-it1/1200/800', 'Tuscan morning', 0)
  returning id into m3;
  update public.visited_countries set cover_media_id = m3 where id = vc_it;

  insert into public.visited_countries (user_id, country_code, country_name, note)
  values (uid, 'PL', 'Poland', 'Kraków under first snow — pierogi steam and trumpet calls from the tower.')
  returning id into vc_pl;
  insert into public.country_visits (visited_country_id, year) values (vc_pl, 2024);
  insert into public.country_cities (visited_country_id, city_name) values (vc_pl, 'Kraków'), (vc_pl, 'Warsaw');

  insert into public.visited_countries (user_id, country_code, country_name, note)
  values (uid, 'FI', 'Finland', 'Ferry over, festival weekend, sauna after. The Baltic circle of life.')
  returning id into vc_fi;
  insert into public.country_visits (visited_country_id, year) values (vc_fi, 2023), (vc_fi, 2024);
  insert into public.country_cities (visited_country_id, city_name) values (vc_fi, 'Helsinki');

  -- Events ------------------------------------------------------
  insert into public.events (user_id, event_type, title, subtitle, event_date, venue, city, country_code, country_name, rating, review, highlight, notes, is_favourite, is_public)
  values (uid, 'concert', 'Aurora Vale', 'The Last Summer Tour', '2023-08-26', 'Estadio Metropolitano', 'Madrid', 'ES', 'Spain', 10,
    '60,000 phones went dark for the acoustic encore. You could hear the city breathing.',
    'Paper Lanterns', 'Opened with Static Hearts; three-song acoustic encore.', true, true)
  returning id into e_madrid;
  insert into public.event_media (event_id, storage_path, public_url, media_type, caption, display_order)
  values (e_madrid, 'seed/con-es-1', 'https://picsum.photos/seed/atlas-con1/1200/700', 'image', 'Lights up', 0)
  returning id into em1;
  insert into public.event_media (event_id, storage_path, public_url, media_type, caption, display_order)
  values (e_madrid, 'seed/con-es-2', 'https://picsum.photos/seed/atlas-con2/1200/700', 'image', 'The encore', 1);
  update public.events set cover_media_id = em1 where id = e_madrid;

  insert into public.events (user_id, event_type, title, subtitle, event_date, venue, city, country_code, country_name, rating, review, highlight, is_public)
  values (uid, 'concert', 'Iron Harbour', 'Northern Steel Tour', '2024-03-15', 'Saku Suurhall', 'Tallinn', 'EE', 'Estonia', 8,
    'Home crowd, wall of guitars, my ears rang until Tuesday and it was worth every decibel.',
    'Rust and Salt', true)
  returning id into e_tallinn;
  insert into public.event_media (event_id, storage_path, public_url, media_type, caption, display_order)
  values (e_tallinn, 'seed/con-ee-1', 'https://picsum.photos/seed/atlas-con3/1200/700', 'image', 'Front row', 0)
  returning id into em2;
  update public.events set cover_media_id = em2 where id = e_tallinn;

  insert into public.events (user_id, event_type, title, subtitle, event_date, venue, city, country_code, country_name, rating, review, highlight, is_public)
  values (uid, 'festival', 'Aurora Vale', 'Midsummer Sound Festival', '2023-06-22', 'Suvilahti', 'Helsinki', 'FI', 'Finland', 10,
    'Festival midnight that never got dark. Danced in a raincoat, dried off in the sauna.',
    'Paper Lanterns', true)
  returning id into e_helsinki;
  insert into public.event_media (event_id, storage_path, public_url, media_type, caption, display_order)
  values (e_helsinki, 'seed/con-fi-1', 'https://picsum.photos/seed/atlas-con4/1200/700', 'image', 'White night crowd', 0)
  returning id into em3;
  update public.events set cover_media_id = em3 where id = e_helsinki;
end $$;
