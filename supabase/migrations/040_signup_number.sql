-- ============================================================
-- Adds a permanent, atomic signup-order number to every account, so the
-- new "Early Explorer" badge (first 1000 signups) can be evaluated with
-- a cheap <= 1000 check on a stored number instead of a live count on
-- every page load — which would only get more expensive as the user
-- base grows, and would let someone "gain" the badge later if an
-- account above them in line ever got deleted. A stored number freezes
-- at signup time instead.
--
-- Backfilled by created_at order for existing rows: a plain
-- ALTER TABLE ... DEFAULT nextval() would backfill in physical row
-- order instead, which isn't guaranteed to match actual signup
-- chronology (e.g. after any row got updated). New rows get their
-- number atomically from the sequence, which is safe under concurrent
-- signups in a way "select count(*) then insert" would not be.
--
-- Locked against tampering the same way accent_color is already reset
-- on downgrade below (profiles' RLS update policy is row-level, not
-- column-level, so nothing stops a client from PATCHing this directly
-- without a trigger like this one clamping it back).
-- ============================================================

create sequence public.profiles_signup_seq;

alter table public.profiles add column signup_number bigint;

update public.profiles p
set signup_number = ranked.rn
from (
  select id, row_number() over (order by created_at, id) as rn
  from public.profiles
) ranked
where p.id = ranked.id;

alter table public.profiles
  alter column signup_number set not null,
  alter column signup_number set default nextval('public.profiles_signup_seq');

alter sequence public.profiles_signup_seq owned by public.profiles.signup_number;

select setval('public.profiles_signup_seq', (select coalesce(max(signup_number), 0) from public.profiles));

create unique index profiles_signup_number_idx on public.profiles (signup_number);

create or replace function public.lock_signup_number()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.signup_number := old.signup_number;
  end if;
  return new;
end;
$$;

create trigger profiles_signup_number_lock before update on public.profiles
  for each row execute function public.lock_signup_number();
