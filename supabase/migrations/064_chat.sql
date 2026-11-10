-- ============================================================
-- Chat: the bubble in the corner of the app.
--
-- Friends (people who follow each other) talk freely. Anyone else gets a
-- postcard: one message, usually stamped with a place, that lands in the
-- other person's postcard stack instead of an inbox. Replying opens the
-- conversation; "Not now" puts it away, and the sender can't send another
-- until the other side writes. Blocks always win.
--
-- Messages arrive live (Supabase Realtime) and as a push notification
-- ("New messages" in Settings).
-- ============================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- The two people, smaller id first, so a pair has one conversation.
  a uuid not null references public.profiles (id) on delete cascade,
  b uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'postcard', 'declined')),
  started_by uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  a_read_at timestamptz not null default now(),
  b_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (a < b),
  unique (a, b)
);
create index if not exists conversations_a_idx on public.conversations (a, last_message_at desc);
create index if not exists conversations_b_idx on public.conversations (b, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  -- A place stamp: a country, and maybe a town in it.
  place_code text check (place_code is null or place_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  place_name text check (place_name is null or length(place_name) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Only the two people in it see a conversation and its messages. Writing
-- goes through send_message() below.
drop policy if exists "conversations: own" on public.conversations;
create policy "conversations: own" on public.conversations for select using (auth.uid() in (a, b));
drop policy if exists "messages: own conversations" on public.messages;
create policy "messages: own conversations" on public.messages for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.a, c.b)));

-- Send a message to someone. Returns the conversation's id.
create or replace function public.send_message(p_to uuid, p_body text, p_place_code text default null, p_place_name text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  conv public.conversations%rowtype;
  friends boolean;
begin
  if me is null then raise exception 'Sign in to send messages.'; end if;
  if p_to is null or p_to = me then raise exception 'Choose someone to write to.'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write something first.'; end if;
  if private.is_blocked_between(me, p_to) then raise exception 'You can''t message this person.'; end if;

  lo := least(me, p_to);
  hi := greatest(me, p_to);
  friends := public.is_mutual_follow(me, p_to);

  select * into conv from public.conversations where a = lo and b = hi;
  if not found then
    insert into public.conversations (a, b, status, started_by)
    values (lo, hi, case when friends then 'open' else 'postcard' end, me)
    returning * into conv;
  elsif conv.status <> 'open' then
    if friends or conv.started_by <> me then
      -- Friends now, or the postcard's receiver writing back: open it.
      update public.conversations set status = 'open' where id = conv.id returning * into conv;
    elsif conv.status = 'postcard' then
      raise exception 'Your postcard is on its way. You can write again when they reply.';
    else
      raise exception 'They''re not taking postcards from you right now.';
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body, place_code, place_name)
  values (conv.id, me, trim(p_body), upper(nullif(trim(coalesce(p_place_code, '')), '')), nullif(trim(coalesce(p_place_name, '')), ''));

  update public.conversations
  set last_message_at = now(),
      a_read_at = case when me = a then now() else a_read_at end,
      b_read_at = case when me = b then now() else b_read_at end
  where id = conv.id;

  return conv.id;
end;
$$;

-- "Not now" on a postcard you received.
create or replace function public.decline_postcard(p_conversation uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.conversations set status = 'declined'
  where id = p_conversation and status = 'postcard' and auth.uid() in (a, b) and started_by <> auth.uid();
$$;

-- You've read a conversation up to now.
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.conversations
  set a_read_at = case when auth.uid() = a then now() else a_read_at end,
      b_read_at = case when auth.uid() = b then now() else b_read_at end
  where id = p_conversation and auth.uid() in (a, b);
$$;

revoke all on function public.send_message(uuid, text, text, text) from public, anon;
revoke all on function public.decline_postcard(uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.send_message(uuid, text, text, text) to authenticated;
grant execute on function public.decline_postcard(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Live: new messages and conversation changes reach the open app.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
end;
$$;

-- A push for each new message, through the same webhook as notifications
-- (/api/push/send, with the secret the push trigger already uses). It
-- respects the receiver's "New messages" switch there.
create or replace function public.trigger_push_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  secret text := substring(pg_get_functiondef('public.trigger_notify_push'::regproc) from 'Bearer ([^'']+)''');
  conv public.conversations%rowtype;
  receiver uuid;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  receiver := case when conv.a = new.sender_id then conv.b else conv.a end;
  if secret is null then return new; end if;
  perform net.http_post(
    url := 'https://expandiax.com/api/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := jsonb_build_object('record', jsonb_build_object(
      'id', new.id,
      'user_id', receiver,
      'actor_id', new.sender_id,
      'kind', case when conv.status = 'postcard' then 'postcard' else 'message' end,
      'target_kind', 'conversation',
      'target_id', conv.id,
      'comment_body', left(new.body, 140)
    ))
  );
  return new;
end;
$$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages
  for each row execute function public.trigger_push_message();
