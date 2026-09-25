-- ============================================================
-- Fires a push notification whenever a row lands in
-- public.notifications (likes, comments, follows) — calls the
-- /api/push/send Vercel route, same net.http_post pattern as
-- 005_notify_follow_webhook.sql. Run this once, after
-- PUSH_WEBHOOK_SECRET and FIREBASE_SERVICE_ACCOUNT_JSON are set in
-- Vercel and a fresh deploy has gone out.
-- ============================================================

create or replace function public.trigger_notify_push()
returns trigger
language plpgsql
as $$
begin
  perform net.http_post(
    url := 'https://expandiax.com/api/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_PUSH_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

create trigger notifications_notify_push
  after insert on public.notifications
  for each row execute function public.trigger_notify_push();
