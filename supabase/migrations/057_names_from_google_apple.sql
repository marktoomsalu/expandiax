-- ============================================================
-- Real names for people who sign up with Google or Apple.
--
-- New profiles took their name only from "display_name", which only the
-- email sign-up form sends — Google and Apple send "full_name" / "name",
-- so everyone using them became "Traveller". New sign-ups now use those,
-- and existing "Traveller" profiles get the name their account already
-- has, where there is one. ("Traveller" stays the fallback.)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      'Traveller'
    ), 80)
  );
  return new;
end;
$$;

-- Everyone still called "Traveller" whose Google/Apple account has a name.
update public.profiles p
set display_name = left(coalesce(
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'name'), '')
), 80)
from auth.users u
where u.id = p.id
  and p.display_name = 'Traveller'
  and coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')) is not null;
