"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PageTransition } from "./PageTransition";
import { cn } from "@/lib/utils";

// /start is a full-screen, immersive flow (its own cold-open/fork/reveal
// layouts, each sized to exactly the viewport) — the floating tab bar
// (see SiteNav.tsx, which hides itself the same way) and this page-end
// footer both break that, and the space reserved for the tab bar leaves a
// stray gap at the bottom of a screen with no tab bar to justify it.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const immersive = path === "/start";

  return (
    <div className={cn(!immersive && "pb-[calc(5.25rem+env(safe-area-inset-bottom))]")}>
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
      {!immersive && (
        <footer className="mt-20 border-t border-line">
          <div className="mx-auto max-w-shell px-5 py-8">
            <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted sm:flex-row sm:items-center">
              <p className="flex items-center">
                <Image src="/wordmark.svg" alt="ExpandiaX" width={1780} height={522} className="h-5 w-auto" />
              </p>
              <p>Collecting the memories that matter.</p>
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center">
              <p>&copy; {new Date().getFullYear()} ExpandiaX. All rights reserved.</p>
              <div className="flex items-center gap-4">
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
