-- ============================================================
-- Apple In-App Purchase support via RevenueCat, alongside Stripe.
-- `billing` stays one row per user — `source` records which payment
-- system most recently wrote plan/premium status into that row. The
-- RevenueCat webhook writes revenuecat_app_user_id/apple_* fields the
-- same way the Stripe webhook writes stripe_* fields: a plain upsert
-- that only ever touches the columns it knows about, never the other
-- provider's columns.
--
-- Existing rows all get source = 'stripe' via the column default —
-- correct, since every premium row today came from Stripe.
--
-- The RevenueCat SDK is configured client-side with our own Supabase
-- user.id as its appUserID (mirrors Stripe's client_reference_id), so
-- webhook events already carry billing.user_id directly as
-- event.app_user_id — no separate id-mapping table needed.
-- revenuecat_app_user_id/apple_original_transaction_id are kept purely
-- for debugging/support lookups.
-- ============================================================

alter table public.billing
  add column source text not null default 'stripe' check (source in ('stripe', 'apple')),
  add column revenuecat_app_user_id text,
  add column apple_original_transaction_id text;

create index billing_revenuecat_app_user_idx on public.billing (revenuecat_app_user_id);
create index billing_apple_original_transaction_idx on public.billing (apple_original_transaction_id);
