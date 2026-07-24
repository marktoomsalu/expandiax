-- ============================================================
-- Premium plan plumbing. Stripe customer/subscription ids live in a
-- separate `billing` table with strict owner-only read access — the
-- `profiles` row is readable by anyone who can see that profile (its
-- select policy is row-level, not column-level), so Stripe identifiers
-- can't safely live there. `profiles.plan` is a denormalized, harmless
-- copy of just the plan name (kept in sync by the trigger below) for
-- cheap/public reads — cap-check triggers, a "Premium" mark on public
-- profiles, etc.
--
-- Only the service-role key (used exclusively by the Stripe webhook
-- route, never by user-facing requests) writes to `billing` — there
-- are deliberately no insert/update policies for regular users.
-- ============================================================

alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free', 'premium'));

create table public.billing (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index billing_stripe_customer_idx on public.billing (stripe_customer_id);
create index billing_stripe_subscription_idx on public.billing (stripe_subscription_id);

alter table public.billing enable row level security;

create policy "owner reads own billing" on public.billing for select
  using (user_id = auth.uid());

create or replace function public.sync_profile_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set plan = new.plan where id = new.user_id;
  return new;
end;
$$;

create trigger billing_sync_plan after insert or update on public.billing
  for each row execute function public.sync_profile_plan();
