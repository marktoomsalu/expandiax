-- ============================================================
-- Premium: a custom accent color on the public profile page, plus a
-- Premium mark next to the name. Gated at the database level too — a
-- BEFORE trigger silently clears accent_color if the row's plan isn't
-- premium, so it also self-clears on downgrade (the same UPDATE that
-- sync_profile_plan() makes to profiles.plan re-fires this trigger).
-- ============================================================

alter table public.profiles
  add column accent_color text;

create or replace function public.enforce_premium_accent_color()
returns trigger language plpgsql as $$
begin
  if new.accent_color is not null and new.plan != 'premium' then
    new.accent_color := null;
  end if;
  return new;
end;
$$;

create trigger profiles_accent_color_gate before insert or update on public.profiles
  for each row execute function public.enforce_premium_accent_color();
