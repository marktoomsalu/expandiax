-- 082: Next Step, the one suggestion at a time after signup (and for
-- everyone already here), and badges celebrated once.
--
-- One row per member, on every device:
--   stage          0 Arrived · 1 Collector · 2 Storyteller · 3 Connected ·
--                  4 Network. Worked out from what they've done; it only
--                  ever goes up (deleting things never takes anyone back).
--   moments        per suggestion: how often it was shown, when it was taken,
--                  how often "Not now" was tapped and when.
--                  {"its-song": {"shown": 2, "lastShown": "...", "dismissed": 1, "dismissedAt": "..."}}
--   dismiss_streak "Not now" on different suggestions in a row; three pause
--                  Next Step for 14 days (paused_until).
--   badges_seen    the badges already celebrated. Null until the first
--                  check, which fills it with what they have without a
--                  celebration (so people already here don't get ten at once).

create table if not exists public.member_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stage smallint not null default 0 check (stage between 0 and 4),
  moments jsonb not null default '{}'::jsonb,
  dismiss_streak smallint not null default 0,
  last_dismissed text,
  paused_until timestamptz,
  badges_seen text[],
  updated_at timestamptz not null default now()
);

alter table public.member_progress enable row level security;

drop policy if exists "member progress: your own" on public.member_progress;
create policy "member progress: your own" on public.member_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.member_progress to authenticated;

-- Shown, taken or "Not now" on one suggestion, in one step.
create or replace function public.note_next_step(p_moment text, p_action text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m jsonb;
  streak smallint;
  last_one text;
  stamp text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if me is null then return; end if;
  if p_action not in ('shown', 'taken', 'dismissed') then raise exception 'unknown action %', p_action; end if;
  if p_moment !~ '^[a-z0-9-]{1,40}$' then raise exception 'unknown moment'; end if;

  insert into public.member_progress (user_id) values (me) on conflict (user_id) do nothing;
  select coalesce(moments -> p_moment, '{}'::jsonb), dismiss_streak, last_dismissed
    into m, streak, last_one
    from public.member_progress where user_id = me for update;

  if p_action = 'shown' then
    m := m || jsonb_build_object('shown', coalesce((m ->> 'shown')::int, 0) + 1, 'lastShown', stamp);
  elsif p_action = 'taken' then
    m := m || jsonb_build_object('taken', stamp);
    streak := 0;
  else
    m := m || jsonb_build_object('dismissed', coalesce((m ->> 'dismissed')::int, 0) + 1, 'dismissedAt', stamp);
    if last_one is distinct from p_moment then streak := streak + 1; end if;
  end if;

  update public.member_progress
     set moments = jsonb_set(moments, array[p_moment], m),
         dismiss_streak = case when streak >= 3 then 0 else streak end,
         last_dismissed = case when p_action = 'dismissed' then p_moment when p_action = 'taken' then null else last_dismissed end,
         paused_until = case when streak >= 3 then now() + interval '14 days' else paused_until end,
         updated_at = now()
   where user_id = me;
end;
$$;

grant execute on function public.note_next_step(text, text) to authenticated;

-- The stage only goes up.
create or replace function public.raise_member_stage(p_stage smallint)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.member_progress (user_id, stage) values (auth.uid(), least(greatest(p_stage, 0), 4))
  on conflict (user_id) do update
    set stage = greatest(public.member_progress.stage, excluded.stage), updated_at = now();
$$;

grant execute on function public.raise_member_stage(smallint) to authenticated;

-- Badges celebrated (or, the first time, already had).
create or replace function public.mark_badges_seen(p_ids text[])
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.member_progress (user_id, badges_seen) values (auth.uid(), p_ids)
  on conflict (user_id) do update
    set badges_seen = array(select distinct unnest(coalesce(public.member_progress.badges_seen, '{}') || excluded.badges_seen)),
        updated_at = now();
$$;

grant execute on function public.mark_badges_seen(text[]) to authenticated;
