-- 086: anonymous usage totals, for the founder's dashboard.
--
-- Which parts of the app are opened, which features are used, and how long
-- visits last, as plain counters per day. Nothing here says who: there is
-- no member id, no device id, no cookie or device storage. A signed-in
-- member's app adds one to a counter; the dashboard reads the totals.
--
--   kind 'page'     key = the kind of page ('trip', 'feed', 'explore'…)
--   kind 'feature'  key = a feature used ('invite_shared', 'chat_opened'…)
--   kind 'visit'    key 'visits' (visits started) or 'seconds' (time in the app)
--
-- Kept for 13 months, like activity_days.

create table if not exists public.usage_totals (
  day date not null,
  kind text not null check (kind in ('page', 'feature', 'visit')),
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  count bigint not null default 0,
  primary key (day, kind, key)
);

alter table public.usage_totals enable row level security;
-- No policies: only the server reads it, and members add to it through the function below.

create or replace function public.note_usage(p_kind text, p_key text, p_amount integer default 1)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage_totals (day, kind, key, count)
  select (now() at time zone 'utc')::date, p_kind, p_key, least(greatest(p_amount, 1), case when p_kind = 'visit' and p_key = 'seconds' then 3600 else 1 end)
  where auth.uid() is not null
    and p_kind in ('page', 'feature', 'visit')
    and p_key ~ '^[a-z0-9_]{1,40}$'
  on conflict (day, kind, key) do update set count = public.usage_totals.count + excluded.count;
$$;

revoke all on function public.note_usage(text, text, integer) from public, anon;
grant execute on function public.note_usage(text, text, integer) to authenticated;
