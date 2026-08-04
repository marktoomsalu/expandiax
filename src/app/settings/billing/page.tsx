import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BillingActions } from "@/components/BillingActions";
import { formatDate } from "@/lib/utils";
import type { Plan } from "@/lib/types";

export const metadata = { title: "Plan" };

export default async function BillingPage({ searchParams }: { searchParams: { upgraded?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: billing } = await supabase
    .from("billing")
    .select("plan, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  const plan: Plan = billing?.plan ?? "free";

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Settings
      </Link>

      <p className="eyebrow mt-6">Plan</p>
      <h1 className="mt-2 text-3xl md:text-4xl">{plan === "premium" ? "You're on Premium." : "You're on the free plan."}</h1>

      {searchParams.upgraded && plan !== "premium" && (
        <p role="status" className="mt-4 rounded-lg border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
          Payment received - this can take a few seconds to reflect. Refresh if it still shows free.
        </p>
      )}

      {plan === "premium" && billing?.current_period_end && (
        <p className="mt-3 text-sm text-muted">Renews {formatDate(billing.current_period_end)}.</p>
      )}

      <ul className="mt-6 space-y-1.5 text-sm text-muted">
        <li>· 15 photos per trip/event, 8 videos (up from 5 and 3)</li>
        <li>· US States tracking, alongside the world map</li>
        <li>· A custom accent color on your public profile</li>
      </ul>

      <div className="mt-8">
        <BillingActions plan={plan} />
      </div>
    </div>
  );
}
