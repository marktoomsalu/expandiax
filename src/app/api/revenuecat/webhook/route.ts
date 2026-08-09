import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PREMIUM_ENTITLEMENT_ID = "premium"; // must match the RevenueCat dashboard entitlement id exactly

// Entitlement becomes/stays active.
const ACTIVE_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "REFUND_REVERSED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
// Entitlement actually ends.
const INACTIVE_TYPES = new Set(["EXPIRATION"]);
// CANCELLATION: auto-renew turned off, but the entitlement is still active
// until expiration — same semantics as Stripe's cancel_at_period_end, so
// intentionally a no-op here, mirroring how the Stripe webhook doesn't
// downgrade until subscription status actually leaves active/trialing.
// BILLING_ISSUE: Apple is retrying the charge during its own grace period —
// also a no-op; only EXPIRATION actually revokes access.
// Everything else (TRANSFER, TEST, paywall/analytics events, etc.): no-op.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[] | null;
  original_transaction_id?: string | null;
  expiration_at_ms?: number | null;
};

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { event } = (await request.json()) as { event?: RevenueCatEvent };

  // app_user_id is our Supabase user.id directly (see configureRevenueCat) —
  // if it's not a UUID, it's a pre-login/anonymous RevenueCat id or a test
  // payload. Ack with 200 so RevenueCat doesn't retry.
  if (!event?.app_user_id || !UUID_RE.test(event.app_user_id)) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (event.entitlement_ids && !event.entitlement_ids.includes(PREMIUM_ENTITLEMENT_ID)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createAdminClient();
  const userId = event.app_user_id;

  if (ACTIVE_TYPES.has(event.type)) {
    await admin.from("billing").upsert({
      user_id: userId,
      source: "apple",
      revenuecat_app_user_id: userId,
      apple_original_transaction_id: event.original_transaction_id ?? null,
      plan: "premium",
      current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    });
  } else if (INACTIVE_TYPES.has(event.type)) {
    // Only downgrade a row we know is currently Apple-sourced — never let a
    // stray/duplicate Apple expiration stomp a Stripe-premium row.
    await admin
      .from("billing")
      .update({ plan: "free", current_period_end: null })
      .eq("user_id", userId)
      .eq("source", "apple");
  }

  return NextResponse.json({ ok: true });
}
