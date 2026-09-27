-- Memories (photos and videos in the "media" bucket) become private: the app
-- hands out short-lived signed links, only for files the viewer is allowed to
-- see (src/lib/signedMedia.ts). Profile photos, which every member can see
-- anyway, move to their own public "avatars" bucket.
--
-- Run in two steps:
--   Step 1 before deploying the app change (creates the avatars bucket).
--   Step 2 after the app change is live (switches memories to private).

-- ---------- Step 1 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "users upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Owners can list their own avatar folder (account deletion uses it); nobody else can list.
create policy "owners list their own avatars"
  on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Step 2 ----------
-- update storage.buckets set public = false where id = 'media';
