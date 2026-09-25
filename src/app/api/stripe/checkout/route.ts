import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { TERMS_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 502 });

  // EU consumers: the subscription starts immediately, so they must have
  // expressly asked for that (and been told what withdrawing then means).
  // The page's checkbox sends this; it's checked here so it can't be skipped.
  const { consent } = (await request.json().catch(() => ({}))) as { consent?: boolean };
  if (consent !== true) return NextResponse.json({ error: "Please confirm the terms to continue." }, { status: 400 });

  try {
    const stripe = getStripe();
    const { data: billing } = await supabase
      .from("billing")
      .select("stripe_customer_id, plan, source")
      .eq("user_id", user.id)
      .maybeSingle();

    // Already premium via Apple IAP — refuse a second, overlapping
    // subscription through Stripe instead of letting someone double-pay.
    if (billing?.plan === "premium" && billing.source === "apple") {
      return NextResponse.json({ error: "You're already Premium through the Apple App Store." }, { status: 409 });
    }

    const origin = request.nextUrl.origin;
    const consentedAt = new Date().toISOString();

    // Only switched on once Stripe Tax is set up in the Stripe Dashboard
    // (business address + registrations) — turning it on earlier makes
    // checkout fail. Prices should be set as tax-inclusive there too.
    const withTax = process.env.STRIPE_AUTOMATIC_TAX === "true";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(billing?.stripe_customer_id
        ? { customer: billing.stripe_customer_id }
        : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: { user_id: user.id, terms_version: TERMS_VERSION, immediate_start_consent_at: consentedAt },
      subscription_data: { metadata: { user_id: user.id, terms_version: TERMS_VERSION, immediate_start_consent_at: consentedAt } },
      custom_text: {
        submit: {
          message: `By subscribing you agree to the [Terms of Service](${origin}/terms). Your subscription renews monthly until you cancel it under Manage subscription.`,
        },
      },
      ...(withTax
        ? {
            automatic_tax: { enabled: true },
            billing_address_collection: "required" as const,
            tax_id_collection: { enabled: true },
            ...(billing?.stripe_customer_id ? { customer_update: { address: "auto" as const, name: "auto" as const } } : {}),
          }
        : {}),
      success_url: `${origin}/settings/billing?upgraded=1`,
      cancel_url: `${origin}/settings/billing`,
    });

    if (!session.url) throw new Error("no_url");
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Could not start checkout. Try again." }, { status: 502 });
  }
}
