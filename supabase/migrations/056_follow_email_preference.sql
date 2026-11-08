-- ============================================================
-- "X started following you" emails can be switched off.
--
-- 1. profiles.follow_email_enabled — on by default, switched off in
--    Settings → Emails or with the one-click link in any follow email.
-- 2. The follow trigger now calls the website (/api/notify/follow), which
--    checks that setting, instead of the old notify-follow Edge Function,
--    which emailed everyone. It reuses the push webhook's secret, read
--    from the push trigger (migration 032), so nothing needs pasting.
--
-- Run after the deploy with /api/notify/follow has gone out.
-- ============================================================

alter table public.profiles add column if not exists follow_email_enabled boolean not null default true;

do $$
declare
  secret text := substring(pg_get_functiondef('public.trigger_notify_push'::regproc) from 'Bearer ([^'']+)''');
begin
  if secret is null or secret = 'REPLACE_WITH_PUSH_WEBHOOK_SECRET' then
    raise exception 'Could not find the push webhook secret in public.trigger_notify_push (migration 032).';
  end if;
  execute format($f$
    create or replace function public.trigger_notify_follow()
    returns trigger
    language plpgsql
    as $body$
    begin
      perform net.http_post(
        url := 'https://expandiax.com/api/notify/follow',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := jsonb_build_object('record', row_to_json(new))
      );
      return new;
    end;
    $body$;
  $f$, 'Bearer ' || secret);
end;
$$;
