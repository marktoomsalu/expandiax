-- ============================================================
-- "Ask someone who's been": questions about a place, answered by members
-- who've been there. Members-only (signed in), hidden between people who've
-- blocked each other, reportable, and deleted with the account.
--
-- Asking notifies the people you follow who've been to that country (up to
-- 20, public trips only); an answer notifies whoever asked. Notifications
-- are pushed like every other kind (the existing webhook on inserts).
--
-- Also: explore_audience(), the counts-only audience numbers for the
-- "For businesses" page — never names, and never a number below 5.
-- ============================================================

create table if not exists public.place_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  -- A town within the country, or '' for the whole country.
  place_name text not null default '' check (length(place_name) <= 100),
  body text not null check (length(trim(body)) between 3 and 500),
  created_at timestamptz not null default now()
);
create index if not exists place_questions_place_idx on public.place_questions (country_code, created_at desc);

create table if not exists public.place_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.place_questions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists place_answers_question_idx on public.place_answers (question_id, created_at);

alter table public.place_questions enable row level security;
alter table public.place_answers enable row level security;

drop policy if exists "questions: members read" on public.place_questions;
create policy "questions: members read" on public.place_questions for select
  using (auth.uid() is not null and not private.is_blocked_between(auth.uid(), user_id));
drop policy if exists "questions: ask" on public.place_questions;
create policy "questions: ask" on public.place_questions for insert with check (user_id = auth.uid());
drop policy if exists "questions: delete own" on public.place_questions;
create policy "questions: delete own" on public.place_questions for delete using (user_id = auth.uid());

drop policy if exists "answers: members read" on public.place_answers;
create policy "answers: members read" on public.place_answers for select
  using (auth.uid() is not null and not private.is_blocked_between(auth.uid(), user_id));
drop policy if exists "answers: answer" on public.place_answers;
create policy "answers: answer" on public.place_answers for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.place_questions q
      where q.id = question_id and not private.is_blocked_between(auth.uid(), q.user_id)
    )
  );
drop policy if exists "answers: delete own" on public.place_answers;
create policy "answers: delete own" on public.place_answers for delete using (user_id = auth.uid());

grant select, insert, delete on public.place_questions, public.place_answers to authenticated;

-- Questions and answers can be reported like everything else people post.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'event', 'country', 'question', 'answer'));

-- Two new notification kinds; target_kind 'question' points at the question.
-- (premium_upsell was retired in 053 and its rows deleted.)
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'question', 'answer'));
alter table public.notifications drop constraint if exists notifications_target_kind_check;
alter table public.notifications add constraint notifications_target_kind_check
  check (target_kind in ('country', 'event', 'question'));

create or replace function public.notify_on_question()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, target_kind, target_id, comment_body)
  select vc.user_id, new.user_id, 'question', 'question', new.id, left(new.body, 200)
  from public.follows f
  join public.visited_countries vc on vc.user_id = f.followee_id
  where f.follower_id = new.user_id
    and vc.country_code = new.country_code
    and vc.is_public
    and vc.user_id <> new.user_id
    and not private.is_blocked_between(new.user_id, vc.user_id)
  limit 20;
  return new;
end;
$$;

drop trigger if exists place_questions_notify on public.place_questions;
create trigger place_questions_notify after insert on public.place_questions
  for each row execute function public.notify_on_question();

create or replace function public.notify_on_answer()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  asker uuid;
begin
  select user_id into asker from public.place_questions where id = new.question_id;
  if asker is not null and asker <> new.user_id and not private.is_blocked_between(asker, new.user_id) then
    insert into public.notifications (user_id, actor_id, kind, target_kind, target_id, comment_body)
    values (asker, new.user_id, 'answer', 'question', new.question_id, left(new.body, 200));
  end if;
  return new;
end;
$$;

drop trigger if exists place_answers_notify on public.place_answers;
create trigger place_answers_notify after insert on public.place_answers
  for each row execute function public.notify_on_answer();

-- Audience numbers for the "For businesses" page: how many members there
-- are, and the countries most often on people's dream lists. Counts only,
-- and a country appears only once at least 5 people dream of it.
create or replace function public.explore_audience()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'members', (select count(*) from public.profiles),
    'dreamers', (select count(distinct user_id) from public.want_to_go),
    'top_dreams', coalesce((
      select json_agg(t order by t.dreamers desc)
      from (
        select country_code, count(distinct user_id) as dreamers
        from public.want_to_go
        group by country_code
        having count(distinct user_id) >= 5
        order by dreamers desc
        limit 12
      ) t
    ), '[]'::json)
  );
$$;

revoke all on function public.explore_audience() from public;
grant execute on function public.explore_audience() to anon, authenticated;
