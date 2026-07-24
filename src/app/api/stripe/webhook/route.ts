import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function upsertBilling(
  admin: ReturnType<typeof createAdminClient>,
  row: { user_id: string; stripe_customer_id: string; stripe_subscription_id: string; plan: "free" | "premium"; current_period_end: string | null }
) {
  await admin.from("billing").upsert(row);
}

// Stripe moved current_period_end from the subscription itself down to each
// subscription item (billing cycles are now per-item, not per-subscription).
function periodEndOf(subscription: Stripe.Subscription): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });

  const stripe = getStripe();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.user_id;
      if (userId && session.customer && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertBilling(admin, {
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan: "premium",
          current_period_end: periodEndOf(subscription),
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const active = subscription.status === "active" || subscription.status === "trialing";
      const periodEnd = periodEndOf(subscription);
      const userId = subscription.metadata?.user_id;

      if (userId) {
        await upsertBilling(admin, {
          user_id: userId,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          plan: active ? "premium" : "free",
          current_period_end: periodEnd,
        });
      } else {
        // No metadata (e.g. a subscription created outside our checkout flow) — fall back to matching by customer id.
        await admin
          .from("billing")
          .update({ plan: active ? "premium" : "free", current_period_end: periodEnd })
          .eq("stripe_customer_id", subscription.customer as string);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
