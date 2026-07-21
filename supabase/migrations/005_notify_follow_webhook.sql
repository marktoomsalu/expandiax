-- ============================================================
-- Wires the notify-follow Edge Function to fire on every new follow.
-- Run this once in the Supabase SQL editor after deploying the function
-- (npx supabase functions deploy notify-follow --no-verify-jwt).
-- ============================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_notify_follow()
returns trigger
language plpgsql
as $$
begin
  perform net.http_post(
    url := 'https://ynjiqozehyipeuaxqroe.supabase.co/functions/v1/notify-follow',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

create trigger notify_follow_after_insert
  after insert on public.follows
  for each row execute function public.trigger_notify_follow();
