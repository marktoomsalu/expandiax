import { Users } from "lucide-react";
import { CONNECTOR_TARGET } from "@/lib/invite";
import { cn } from "@/lib/utils";

/** The Connector badge: brought 5 friends to ExpandiaX (who made their accounts). */
export function ConnectorBadge({ count, className }: { count: number; className?: string }) {
  if (count < CONNECTOR_TARGET) return null;
  return (
    <div className={cn("relative isolate overflow-hidden rounded-card px-5 py-5 text-white shadow-lg sm:px-6 sm:py-6", className)} style={{ background: "linear-gradient(135deg, #7c1d6f, #fa51a2 55%, #fb7822)" }}>
      <div aria-hidden className="animate-badge-shimmer pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/40">
          <Users size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/80">Connector</p>
          <p className="mt-0.5 font-serif text-lg leading-snug sm:text-xl">Brought {count} friends to ExpandiaX.</p>
          <p className="mt-1 text-xs font-semibold tracking-wide text-white/85">Worlds are better shared</p>
        </div>
      </div>
    </div>
  );
}
