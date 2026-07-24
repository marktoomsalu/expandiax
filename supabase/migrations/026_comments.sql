-- ============================================================
-- Comments on feed content (countries and events), mirroring the
-- kind/target_id polymorphic pattern already used by public.likes.
--
-- Deletion is allowed for two people: the commenter (their own words)
-- and the owner of the target content (moderating what's said about
-- their own trip/event) — enforced directly in the delete policy.
-- ============================================================

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('country', 'event')),
  target_id uuid not null,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_target_idx on public.comments (kind, target_id, created_at);

alter table public.comments enable row level security;

create policy "comments readable when target visible"
  on public.comments for select
  using (
    (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
    or
    (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
  );

create policy "users comment on visible content"
  on public.comments for insert
  with check (
    user_id = auth.uid()
    and (
      (kind = 'country' and (public.owns_visited_country(target_id) or public.visited_country_is_public(target_id)))
      or
      (kind = 'event' and (public.owns_event(target_id) or public.event_is_public(target_id)))
    )
  );

create policy "commenter or content owner deletes comment"
  on public.comments for delete
  using (
    user_id = auth.uid()
    or (kind = 'country' and public.owns_visited_country(target_id))
    or (kind = 'event' and public.owns_event(target_id))
  );
