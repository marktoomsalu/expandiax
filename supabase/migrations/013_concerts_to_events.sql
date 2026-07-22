-- ============================================================
-- Generalize "concerts" into "events" — concert, festival, sport,
-- conference, personal, or other. Renames the table, its columns, and
-- every dependent function/policy/view. Uses RENAME throughout so all
-- existing data (including storage paths, which are untouched) carries
-- over losslessly.
--
-- Function bodies (SQL/plpgsql) do NOT auto-update when a table/column
-- they reference is renamed — only views and policies do, via internal
-- OID tracking. So every function that mentions "concert" is explicitly
-- rebuilt below. Order matters: old functions (owns_concert,
-- concert_is_public) aren't dropped until every policy that still calls
-- them — including the ones on `likes` — has been rebuilt against the
-- new functions first.
--
-- Run this once in the Supabase SQL editor on top of the earlier migrations.
-- ============================================================

-- ---------- Table + column renames ----------

alter table public.concerts rename to events;
alter table public.concert_media rename to event_media;

alter table public.events rename column artist_name to title;
alter table public.events rename column concert_name to subtitle;
alter table public.events rename column concert_date to event_date;
alter table public.events rename column favourite_song to highlight;
alter table public.events rename column setlist_notes to notes;

alter table public.event_media rename column concert_id to event_id;

alter table public.events
  add column event_type text not null default 'concert'
  check (event_type in ('concert', 'festival', 'sport', 'conference', 'personal', 'other'));

-- ---------- Cosmetic renames (indexes, constraint, triggers, policies) ----------

alter index concerts_user_date_idx rename to events_user_date_idx;
alter index concerts_country_idx rename to events_country_idx;
alter index concert_media_concert_idx rename to event_media_event_idx;

alter table public.events rename constraint concerts_cover_media_fk to events_cover_media_fk;

-- The FK from event_media.event_id -> events.id keeps its old auto-generated
-- name (concert_media_concert_id_fkey) unless renamed explicitly — the app
-- code references it by name (event_media!event_media_event_id_fkey) to
-- disambiguate it from the cover-media FK, so this rename is required, not
-- just cosmetic.
alter table public.event_media
  rename constraint concert_media_concert_id_fkey to event_media_event_id_fkey;

alter trigger concerts_touch on public.events rename to events_touch;

alter policy "concerts readable when owner or public" on public.events
  rename to "events readable when owner or public";
alter policy "owner inserts concerts" on public.events rename to "owner inserts events";
alter policy "owner updates concerts" on public.events rename to "owner updates events";
alter policy "owner deletes concerts" on public.events rename to "owner deletes events";

-- ---------- Media-cap trigger: rebuild under the new names ----------

drop trigger concert_media_cap on public.event_media;
drop function public.enforce_concert_media_cap();

create function public.enforce_event_media_cap()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from public.event_media
  where event_id = new.event_id and media_type = new.media_type;
  if new.media_type = 'image' and n >= 5 then
    raise exception 'An event can have at most 5 photos.';
  end if;
  if new.media_type = 'video' and n >= 3 then
    raise exception 'An event can have at most 3 videos.';
  end if;
  return new;
end;
$$;

create trigger event_media_cap before insert on public.event_media
  for each row execute function public.enforce_event_media_cap();

-- ---------- New ownership/visibility helpers (old ones stay for now —
-- the likes policies below still need them until they're rebuilt too) ----------

create function public.owns_event(e_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.events where id = e_id and user_id = auth.uid());
$$;

create function public.event_is_public(e_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = e_id and e.is_public and public.is_profile_public(e.user_id)
  );
$$;

-- ---------- event_media policies: point at the new helpers ----------

drop policy "concert media readable" on public.event_media;
drop policy "concert media insert" on public.event_media;
drop policy "concert media update" on public.event_media;
drop policy "concert media delete" on public.event_media;

create policy "event media readable" on public.event_media for select
  using (public.owns_event(event_id) or public.event_is_public(event_id));
create policy "event media insert" on public.event_media for insert
  with check (public.owns_event(event_id));
create policy "event media update" on public.event_media for update
  using (public.owns_event(event_id))
  with check (public.owns_event(event_id));
create policy "event media delete" on public.event_media for delete
  using (public.owns_event(event_id));

-- ---------- likes: migrate the 'concert' kind value to 'event', then
-- rebuild its policies against the new helpers ----------

update public.likes set kind = 'event' where kind = 'concert';
update public.reports set target_type = 'event' where target_type = 'concert';

alter table public.likes drop constraint likes_kind_check;
alter table public.likes add constraint likes_kind_check check (kind in ('country', 'event'));

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'event', 'country'));

drop policy "likes readable when target visible" on public.likes;
drop policy "users like visible content" on public.likes;

create policy "likes readable when target visible"
  on public.likes for select
  using (
    (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
    or
    (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
  );

create policy "users like visible content"
  on public.likes for insert
  with check (
    user_id = auth.uid()
    and (
      (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
      or
      (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
    )
  );

-- Now safe to drop the old helpers — the event_media and likes policies
-- that used them have all been rebuilt against owns_event/event_is_public.
drop function public.owns_concert(uuid);
drop function public.concert_is_public(uuid);

-- ---------- feed_events: rebuild with the new names + event_type ----------

drop view if exists public.feed_events;

create view public.feed_events
with (security_invoker = true) as
  select
    'country'::text as kind,
    null::text as event_type,
    vc.id as ref_id,
    vc.user_id as actor_id,
    vc.country_code as country_code,
    vc.country_name as title,
    null::text as subtitle,
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    lv.year as visit_year,
    coalesce(lv.visited_to, lv.visited_from) as visit_date,
    vc.created_at as created_at
  from public.visited_countries vc
  left join lateral (
    select public_url, media_type
    from public.country_media
    where visited_country_id = vc.id
    order by (id = vc.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
  left join lateral (
    select year, visited_from, visited_to
    from public.country_visits
    where visited_country_id = vc.id
    order by coalesce(visited_to, visited_from, make_date(year, 12, 31)) desc
    limit 1
  ) lv on true
  where vc.share_to_feed
  union all
  select
    'event'::text as kind,
    e.event_type as event_type,
    e.id as ref_id,
    e.user_id as actor_id,
    e.country_code as country_code,
    e.title as title,
    nullif(e.subtitle, '') as subtitle,
    cm.public_url as cover_url,
    cm.media_type as cover_media_type,
    extract(year from e.event_date)::int as visit_year,
    e.event_date as visit_date,
    e.created_at as created_at
  from public.events e
  left join lateral (
    select public_url, media_type
    from public.event_media
    where event_id = e.id
    order by (id = e.cover_media_id) desc, display_order asc
    limit 1
  ) cm on true
  where e.is_public and e.share_to_feed;

grant select on public.feed_events to authenticated;
