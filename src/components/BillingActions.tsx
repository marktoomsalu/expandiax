"use client";

import { useState } from "react";
import type { Plan } from "@/lib/types";

export function BillingActions({ plan }: { plan: Plan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string) {
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

  return (
    <div>
      {plan === "premium" ? (
        <button type="button" className="btn-ghost" onClick={() => go("/api/stripe/portal")} disabled={busy}>
          {busy ? "Opening…" : "Manage subscription"}
        </button>
      ) : (
        <button type="button" className="btn-accent" onClick={() => go("/api/stripe/checkout")} disabled={busy}>
          {busy ? "Redirecting…" : "Upgrade to Premium"}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}
