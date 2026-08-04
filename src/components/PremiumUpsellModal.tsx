"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Check, Sparkles, X } from "lucide-react";

const STORAGE_KEY = "expandiax:premium-upsell-last-shown";
const REPEAT_DAYS = 4;
const SKIP_PATH_PREFIXES = ["/settings", "/sign-in", "/sign-up", "/onboarding"];

const FEATURES = [
  "Unlimited countries & events",
  "15 photos & 8 videos per entry",
  "US States tracking map",
  "Custom accent colour & Premium badge",
];

export function PremiumUpsellModal({ plan }: { plan: "free" | "premium" | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (plan !== "free") return;
    if (SKIP_PATH_PREFIXES.some((p) => pathname?.startsWith(p))) return;

    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
    if (daysSince < REPEAT_DAYS) return;

    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
    // Only re-evaluate on genuine navigation, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, pathname]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upsell-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-card border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="gradient-travel pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.22] blur-2xl"
        />
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute right-4 top-4 text-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="px-7 pb-7 pt-8">
          <p className="eyebrow flex items-center gap-1.5 text-accent">
            <Sparkles size={13} aria-hidden /> Premium
          </p>
          <h2 id="upsell-title" className="mt-2 font-serif text-2xl">
            Your world shouldn&rsquo;t have a limit.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Free plans cap out at 40 countries and 20 events. Go Premium for unlimited entries - plus:
          </p>
          <ul className="mt-5 space-y-2.5 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex items-center gap-4">
            <Link
              href="/settings/billing"
              onClick={dismiss}
              className="btn-accent flex-1 justify-center !py-2.5 text-center"
            >
              Go Premium - $4/mo
            </Link>
            <button type="button" onClick={dismiss} className="text-sm text-muted hover:text-ink">
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
