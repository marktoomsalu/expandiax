-- ============================================================
-- Chat safety: no selling, no spam, no scams.
--
-- Everything is checked in the database, inside send_message(), so no app
-- or script can get around it:
--   * postcards (first messages to people who aren't friends) can't carry
--     links, emails, phone numbers, "message me on WhatsApp", or selling
--     and scam words;
--   * scam words are refused in every chat;
--   * new accounts (under a day old) can't send postcards, and nobody can
--     send more than 5 new postcards a day;
--   * 20 messages a minute and 300 a day at most;
--   * postcards pause for someone whose postcards keep being turned down
--     (3 in 30 days) or whose messages 2 people reported; all messages
--     pause at 3 reporters, until an admin looks.
-- People can report a message ('message' in reports) and block from chat.
-- ============================================================

-- 1. Messages can be reported.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'event', 'country', 'question', 'answer', 'message'));

-- When someone's postcard was turned down (for the 3-in-30-days rule).
alter table public.conversations add column if not exists declined_at timestamptz;

create or replace function public.decline_postcard(p_conversation uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.conversations set status = 'declined', declined_at = now()
  where id = p_conversation and status = 'postcard' and auth.uid() in (a, b) and started_by <> auth.uid();
$$;

-- 2. What a message may not say: a reason, or null when it's fine. The
--    same patterns as src/lib/chatRules.ts (whose tests check real
--    sentences); \y is a word boundary here.
create or replace function private.chat_problem(p_body text, p_first_contact boolean)
returns text
language plpgsql immutable
as $$
declare
  t text := lower(p_body);
  span text;
begin
  if t ~ '\y(crypto|bitcoin|btc|usdt|forex|binary options?|investment opportunit[a-z]*|invest with me|double your money|guaranteed (return|profit)s?|gift ?cards?|wire transfer|western union|moneygram|sugar ?(daddy|baby)|escorts?|onlyfans|casino|betting tips|loan offers?|recovery? (your )?funds)\y' then
    return 'This looks like spam or a scam, so it wasn''t sent.';
  end if;
  if not p_first_contact then
    return null;
  end if;
  if t ~ '(https?://|www\.|\y[a-z0-9-]+\.(com|net|org|io|co|shop|store|biz|info|me|ly|link|app|site|online)\y)' then
    return 'Postcards can''t include links. Once they write back, you can share more.';
  end if;
  if t ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    return 'Postcards can''t include email addresses.';
  end if;
  for span in select (regexp_matches(t, '[+0-9][0-9 ().-]{6,}[0-9]', 'g'))[1] loop
    if length(regexp_replace(span, '[^0-9]', '', 'g')) >= 8 and trim(span) !~ '^(19|20)[0-9]{2}[^0-9]+(19|20)[0-9]{2}$' then
      return 'Postcards can''t include phone numbers.';
    end if;
  end loop;
  if t ~ '\y(whats ?app|telegram|signal me|snapchat|snap me|kik|wechat|dm me|text me|call me|add me on|follow me on|my insta)\y' then
    return 'Postcards are for talking here, not moving the chat elsewhere.';
  end if;
  if t ~ '(\yfor sale\y|\yon sale\y|\ybuy now\y|\ybuy from me\y|\ysell(ing)?\y|\ydiscounts?\y|\ypromo(tion)?s?\y|\ycoupons?\y|\yorder now\y|\yshop now\y|% off\y|\yspecial offers?\y|\yhire me\y|\ymy services\y|\ybusiness opportunit[a-z]*|\ybest prices?\y|\ycheap (flights|tickets|hotels|rooms)\y)' then
    return 'Postcards are for talking about places, not selling. Write about the trip instead.';
  end if;
  return null;
end;
$$;

-- 3. send_message (from 064), with the rules above.
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
  first_contact boolean;
  problem text;
  reporters int;
begin
  if me is null then raise exception 'Sign in to send messages.'; end if;
  if p_to is null or p_to = me then raise exception 'Choose someone to write to.'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write something first.'; end if;
  if private.is_blocked_between(me, p_to) then raise exception 'You can''t message this person.'; end if;

  -- Pace.
  if (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little: try again in a minute.';
  end if;
  if (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 day') >= 300 then
    raise exception 'That''s a lot of messages today. You can write again tomorrow.';
  end if;

  -- Reported by several people: paused until someone looks.
  select count(distinct r.reporter_id) into reporters
  from public.reports r join public.messages m on m.id = r.target_id
  where r.target_type = 'message' and m.sender_id = me and r.created_at > now() - interval '30 days';
  if reporters >= 3 then
    raise exception 'Your messages are paused while we look at some reports. Write to hello@expandiax.com if you think this is a mistake.';
  end if;

  lo := least(me, p_to);
  hi := greatest(me, p_to);
  friends := public.is_mutual_follow(me, p_to);
  select * into conv from public.conversations where a = lo and b = hi;

  -- A postcard: the first message to someone who isn't a friend.
  first_contact := not friends and (conv.id is null or (conv.status <> 'open' and conv.started_by = me));

  problem := private.chat_problem(p_body, first_contact);
  if problem is not null then raise exception '%', problem; end if;

  if first_contact and conv.id is null then
    if (select created_at from public.profiles where id = me) > now() - interval '1 day' then
      raise exception 'New accounts can send postcards after their first day. Friends you follow back can chat right away.';
    end if;
    if (select count(*) from public.conversations where started_by = me and created_at > now() - interval '1 day' and status <> 'open') >= 5 then
      raise exception 'That''s 5 postcards today. You can send more tomorrow.';
    end if;
    if (select count(*) from public.conversations where started_by = me and status = 'declined' and declined_at > now() - interval '30 days') >= 3
       or reporters >= 2 then
      raise exception 'Postcards are paused for your account for now. You can still chat with friends.';
    end if;
  end if;

  if conv.id is null then
    insert into public.conversations (a, b, status, started_by)
    values (lo, hi, case when friends then 'open' else 'postcard' end, me)
    returning * into conv;
  elsif conv.status <> 'open' then
    if friends or conv.started_by <> me then
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

revoke all on function private.chat_problem(text, boolean) from public;
revoke all on function public.send_message(uuid, text, text, text) from public, anon;
grant execute on function public.send_message(uuid, text, text, text) to authenticated;
