"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Browser } from "@capacitor/browser";
import type { BillingSource, Plan } from "@/lib/types";
import { isNativePlatform } from "@/lib/capacitor";
import { purchasePremium, restorePurchases, getManagementUrl, isPurchaseCancelled } from "@/lib/revenuecat";

export function BillingActions({ plan, source }: { plan: Plan; source: BillingSource | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const native = isNativePlatform();

  async function goStripe(path: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Something went wrong.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function buyNative() {
    setBusy(true);
    setError(null);
    try {
      await purchasePremium();
      // Authoritative flip happens server-side via the RevenueCat webhook —
      // reuse Stripe's exact "?upgraded=1" success banner rather than
      // inventing new UX for this.
      router.push("/settings/billing?upgraded=1");
      router.refresh();
    } catch (e) {
      if (!isPurchaseCancelled(e)) setError(e instanceof Error ? e.message : "Purchase failed. Try again.");
      setBusy(false);
    }
  }

  async function restoreNative() {
    setBusy(true);
    setError(null);
    try {
      const { isPremium } = await restorePurchases();
      router.push(isPremium ? "/settings/billing?upgraded=1" : "/settings/billing");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore purchases.");
    } finally {
      setBusy(false);
    }
  }

  async function openAppleSubscriptions() {
    setBusy(true);
    setError(null);
    try {
      const url = await getManagementUrl();
      if (!url) throw new Error("No active subscription to manage.");
      if (native) await Browser.open({ url });
      else window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open subscription management.");
    } finally {
      setBusy(false);
    }
  }

  if (plan === "premium" && source === "apple") {
    return (
      <div>
        <p className="text-sm text-muted">Managed through the Apple App Store.</p>
        <button type="button" className="btn-ghost mt-2 !py-2 text-sm" onClick={openAppleSubscriptions} disabled={busy}>
          {busy ? "Opening…" : "Manage subscription"}
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (plan === "premium") {
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => goStripe("/api/stripe/portal")} disabled={busy}>
          {busy ? "Opening…" : "Manage subscription"}
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (native) {
    return (
      <div>
        <button type="button" className="btn-accent" onClick={buyNative} disabled={busy}>
          {busy ? "Purchasing…" : "Upgrade to Premium"}
        </button>
        <button type="button" className="btn-ghost mt-2 block !py-2 text-sm" onClick={restoreNative} disabled={busy}>
          Restore purchases
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn-accent" onClick={() => goStripe("/api/stripe/checkout")} disabled={busy}>
        {busy ? "Redirecting…" : "Upgrade to Premium"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}
