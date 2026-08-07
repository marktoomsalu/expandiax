import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: billing } = await supabase
    .from("billing")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!billing?.stripe_customer_id) return NextResponse.json({ error: "No subscription found." }, { status: 404 });

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/settings/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Could not open the billing portal. Try again." }, { status: 502 });
  }
}
