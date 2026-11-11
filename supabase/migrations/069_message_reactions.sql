-- ============================================================
-- Reactions on chat messages: ExpandiaX's own six (love, haha, dreamy,
-- wow, aww, yes). One per person per message: change it, or take it back.
-- Only the two people in the chat can see or add them; nothing in a
-- declined postcard chat.
-- ============================================================

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('love', 'haha', 'dreamy', 'wow', 'sad', 'yes')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

-- Whether you're one of the two people in this message's chat (and it's still open to you).
create or replace function private.in_message_chat(p_message uuid, p_writable boolean default false)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = p_message
      and auth.uid() in (c.a, c.b)
      and (not p_writable or c.status <> 'declined')
  );
$$;
revoke all on function private.in_message_chat(uuid, boolean) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.in_message_chat(uuid, boolean) to authenticated;

drop policy if exists "reactions: see in your chats" on public.message_reactions;
create policy "reactions: see in your chats" on public.message_reactions for select
  using (private.in_message_chat(message_id));

drop policy if exists "reactions: add your own" on public.message_reactions;
create policy "reactions: add your own" on public.message_reactions for insert
  with check (user_id = auth.uid() and private.in_message_chat(message_id, true));

drop policy if exists "reactions: change your own" on public.message_reactions;
create policy "reactions: change your own" on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.in_message_chat(message_id, true));

drop policy if exists "reactions: take back your own" on public.message_reactions;
create policy "reactions: take back your own" on public.message_reactions for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.message_reactions to authenticated;

-- Live: a reaction shows up on the other phone straight away.
do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end;
$$;
