-- Photos and videos stay viewable by their links (the bucket is public, and
-- public-URL downloads don't go through these policies), but nobody can
-- list the bucket any more — before this, anyone with the app's public key
-- could list every user's folder and download private and friends-only
-- accounts' photos. Owners can still list their own folder (account
-- deletion uses that to remove every file).

drop policy if exists "media is publicly readable" on storage.objects;

create policy "owners list their own media"
  on storage.objects for select
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
