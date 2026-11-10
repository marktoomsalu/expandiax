-- A cover photo at the top of each profile. Without one, the profile shows
-- photos of the person's home country (a different one each day); with
-- one, theirs. Uploaded to the public avatars bucket, under their own
-- folder (<user id>/cover/...), which its existing policies already allow.
alter table public.profiles add column if not exists cover_url text
  check (cover_url is null or (cover_url ~ '^https://' and length(cover_url) <= 1000));
