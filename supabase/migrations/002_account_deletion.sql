-- ============================================================
-- Self-service account deletion.
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

-- Deletes the calling user's own auth.users row. Cascades through
-- profiles -> visited_countries / concerts -> their child tables via the
-- existing "on delete cascade" foreign keys, so this alone removes all of
-- a user's database rows. It does NOT remove their uploaded files from
-- Storage — the app removes those itself, client-side, before calling this.
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
