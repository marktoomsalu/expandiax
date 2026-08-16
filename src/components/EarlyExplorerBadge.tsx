import { Telescope } from "lucide-react";
import { EARLY_EXPLORER_THRESHOLD, isEarlyExplorer } from "@/lib/badges";
import { cn } from "@/lib/utils";

export function EarlyExplorerBadge({ signupNumber, className }: { signupNumber: number; className?: string }) {
  if (!isEarlyExplorer(signupNumber)) return null;

  return (
    <div
      className={cn(
        "gradient-travel relative isolate overflow-hidden rounded-card px-5 py-5 text-white shadow-lg shadow-accent/30 sm:px-6 sm:py-6",
        className
      )}
    >
      <div
        aria-hidden
        className="animate-badge-shimmer pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/40">
          <Telescope size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-sans font-semibold uppercase tracking-[0.18em] text-white/80">Early Explorer</p>
          <p className="mt-0.5 font-serif text-lg leading-snug sm:text-xl">
            One of ExpandiaX&rsquo;s first {EARLY_EXPLORER_THRESHOLD} travellers.
          </p>
          <p className="mt-1 text-xs text-white/75">Member #{signupNumber}</p>
        </div>
      </div>
    </div>
  );
}
