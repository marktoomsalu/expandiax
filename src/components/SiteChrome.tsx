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
export const TIKTOK_URL = "https://www.tiktok.com/@expandiax";

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

/** TikTok's note (its brand mark, in one colour). */
function TikTokGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

const social = "inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const immersive = path === "/start" || path === "/touch" || path.startsWith("/wrapped");
  // No tab bar while signing up either (see SiteNav.tsx), so no room for one.
  const hasTabBar = !immersive && path !== "/sign-up" && path !== "/onboarding";
  // In the app, creating an account is one screen: no website footer below it to scroll to.
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativePlatform()), []);
  const footer = !immersive && !(native && (path === "/sign-up" || path === "/onboarding"));

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
                {/* Where to follow us: Instagram and TikTok, side by side. */}
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="text-sm text-muted">Follow us</span>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="ExpandiaX on Instagram, @expandiax.app" className={social}>
                    <InstagramGlyph /> @expandiax.app
                  </a>
                  <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" aria-label="ExpandiaX on TikTok, @expandiax" className={social}>
                    <TikTokGlyph /> @expandiax
                  </a>
                  </div>
                </div>
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
