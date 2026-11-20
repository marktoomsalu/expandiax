-- 085: "active today" is recorded again.
--
-- activity_days (migration 055) has stayed empty: the day was written only
-- when the server renewed someone's session, but the app renews it by
-- itself before it expires, so the server almost never did. Now the server
-- notes the day directly whenever it shows a signed-in member a page,
-- through this function (the day only, as before: never what they looked at,
-- no cookie or device storage). A second note on the same day does nothing.

create or replace function public.note_active_day()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_days (user_id, day)
  select auth.uid(), (now() at time zone 'utc')::date
  where auth.uid() is not null
  on conflict (user_id, day) do nothing;
$$;

revoke all on function public.note_active_day() from public, anon;
grant execute on function public.note_active_day() to authenticated;
