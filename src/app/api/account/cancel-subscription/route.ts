import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Called right before an account is deleted, so deleting your account can
// never leave a subscription billing you afterwards. If Stripe can't be
// reached the caller must NOT delete the account (it gets a 502).
//
// Apple subscriptions can't be cancelled by us — Apple owns them — so the
// caller warns the user about those before getting here.
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const supabase = createClient();
  const { data: billing } = await supabase
    .from("billing")
    .select("stripe_subscription_id, source, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (billing?.source === "apple" && billing.plan === "premium") return NextResponse.json({ ok: true, apple: true });
  if (!billing?.stripe_subscription_id) return NextResponse.json({ ok: true });

  const stripe = getStripe();
  try {
    const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
    if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
      await stripe.subscriptions.cancel(billing.stripe_subscription_id);
    }
    return NextResponse.json({ ok: true, cancelled: true });
  } catch (e) {
    // Already gone at Stripe's end — nothing left to bill.
    if (e && typeof e === "object" && "code" in e && e.code === "resource_missing") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "Could not cancel the subscription." }, { status: 502 });
  }
}
