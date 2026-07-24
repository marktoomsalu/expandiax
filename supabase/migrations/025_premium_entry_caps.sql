-- ============================================================
-- Free plan caps total countries at 40 and total events at 20;
-- Premium is unlimited. Enforced here via BEFORE INSERT triggers
-- (the real boundary), counting the user's existing rows.
--
-- Deliberately does NOT touch existing data — a free user already over
-- the cap (e.g. logged before this shipped) keeps everything they have
-- and can still edit/delete it; they just can't ADD more until they
-- upgrade or drop back under the cap. Nothing already logged is ever
-- hidden or removed.
-- ============================================================

create or replace function public.enforce_country_entry_cap()
returns trigger language plpgsql as $$
declare
  user_plan text;
begin
  select plan into user_plan from public.profiles where id = new.user_id;
  if user_plan != 'premium'
     and (select count(*) from public.visited_countries where user_id = new.user_id) >= 40 then
    raise exception 'Free plan is capped at 40 countries — upgrade to Premium for unlimited.';
  end if;
  return new;
end;
$$;

create trigger visited_countries_entry_cap before insert on public.visited_countries
  for each row execute function public.enforce_country_entry_cap();

create or replace function public.enforce_event_entry_cap()
returns trigger language plpgsql as $$
declare
  user_plan text;
begin
  select plan into user_plan from public.profiles where id = new.user_id;
  if user_plan != 'premium'
     and (select count(*) from public.events where user_id = new.user_id) >= 20 then
    raise exception 'Free plan is capped at 20 events — upgrade to Premium for unlimited.';
  end if;
  return new;
end;
$$;

create trigger events_entry_cap before insert on public.events
  for each row execute function public.enforce_event_entry_cap();
