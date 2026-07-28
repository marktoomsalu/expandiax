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
      'Authorization', 'Bearer 870c986f92415f16b416cd5387c1d026863a0b009f724da392486eb126fc81ed'
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

create trigger notifications_notify_push
  after insert on public.notifications
  for each row execute function public.trigger_notify_push();
