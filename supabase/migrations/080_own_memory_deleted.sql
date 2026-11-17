-- 080: someone deletes their own memory of a shared trip or event (078).
--
-- The link to it was left pointing at nothing, so their tag on the trip
-- ("Melody") opened "This page could not be found". Now deleting it takes
-- the link with it: they're still on the original, as having joined it.

create or replace function public.collab_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.post_collaborators where kind = tg_argv[0] and target_id = old.id;
  -- Someone's own memory of another trip or event: still on that one, as joined.
  update public.post_collaborators set own_target_id = null where kind = tg_argv[0] and own_target_id = old.id;
  delete from public.moment_invites where kind = tg_argv[0] and target_id = old.id;
  delete from public.notifications where kind in ('collab_invite', 'collab_accepted', 'collab_request') and target_kind = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;

-- Links already left pointing at a deleted trip or event.
update public.post_collaborators pc set own_target_id = null
where pc.kind = 'trip' and pc.own_target_id is not null
  and not exists (select 1 from public.country_visits v where v.id = pc.own_target_id);
update public.post_collaborators pc set own_target_id = null
where pc.kind = 'event' and pc.own_target_id is not null
  and not exists (select 1 from public.events e where e.id = pc.own_target_id);
