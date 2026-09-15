"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isNativePlatform } from "@/lib/capacitor";
import { getPremiumProduct, subscriptionPeriodLabel } from "@/lib/revenuecat";

// The $4/mo fallback matches the homepage's advertised price — shown while
// the live, locale-accurate value loads from the store (native only; the
// Stripe checkout page itself already discloses price/terms on web).
const FALLBACK = { title: "ExpandiaX Premium", priceString: "$4.00", period: "Every month" };

export function SubscriptionDisclosure() {
  const [info, setInfo] = useState<typeof FALLBACK | null>(null);

  useEffect(() => {
    if (!isNativePlatform()) return;
    getPremiumProduct()
      .then((p) => p && setInfo({ title: p.title, priceString: p.priceString, period: subscriptionPeriodLabel(p.period) }))
      .catch(() => {
        // Fallback text still shows — never block the purchase button on this.
      });
  }, []);

  const shown = info ?? FALLBACK;

  return (
    <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
      <p className="font-medium">{shown.title}</p>
      <p className="mt-0.5 text-muted">
        {shown.period} &middot; {shown.priceString}
      </p>
      <p className="mt-2 text-xs text-muted">
        <Link href="/terms" className="underline underline-offset-2 hover:text-ink">Terms of Use</Link>
        {" "}&middot;{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy Policy</Link>
      </p>
    </div>
  );
}
