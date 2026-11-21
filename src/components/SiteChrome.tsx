"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageTransition } from "./PageTransition";
import { StoreBadges } from "./AppStoreBadge";
import { cn } from "@/lib/utils";
import { isNativePlatform } from "@/lib/capacitor";

// /start is a full-screen, immersive flow (its own cold-open/fork/reveal
// layouts, each sized to exactly the viewport) — the floating tab bar
// (see SiteNav.tsx, which hides itself the same way) and this page-end
// footer both break that, and the space reserved for the tab bar leaves a
// stray gap at the bottom of a screen with no tab bar to justify it.
export const INSTAGRAM_URL = "https://www.instagram.com/expandiax.app/";

/** Instagram's camera outline (lucide no longer ships brand icons). */
function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const immersive = path === "/start" || path === "/touch";
  // No tab bar while signing up either (see SiteNav.tsx), so no room for one.
  const hasTabBar = !immersive && path !== "/sign-up";
  // In the app, creating an account is one screen: no website footer below it to scroll to.
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativePlatform()), []);
  const footer = !immersive && !(native && path === "/sign-up");

  return (
    <div className={cn(hasTabBar && "pb-[calc(5.25rem+env(safe-area-inset-bottom))]")}>
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
      {footer && (
        <footer className="mt-20 border-t border-line">
          <div className="mx-auto max-w-shell px-5 py-8">
            <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted sm:flex-row sm:items-center">
              <p className="flex items-center">
                <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} className="h-5 w-auto" />
              </p>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <p>Your world, remembered.</p>
                <StoreBadges height={36} className="sm:justify-end" />
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  <InstagramGlyph /> Follow us on Instagram <span className="text-muted">@expandiax.app</span>
                </a>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center">
              <p>&copy; {new Date().getFullYear()} ExpandiaX. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link href="/partners" className="hover:text-ink">For partners</Link>
                <Link href="/terms" className="hover:text-ink">Terms</Link>
                <Link href="/privacy" className="hover:text-ink">Privacy</Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
