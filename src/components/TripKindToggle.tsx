"use client";

import { Home, Plane } from "lucide-react";
import type { TripKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Trip, or somewhere you lived — one tap each way. */
export function TripKindToggle({ value, onChange, className }: { value: TripKind; onChange: (k: TripKind) => void; className?: string }) {
  return (
    <div className={cn("flex rounded-full border border-line p-1", className)} role="group" aria-label="Type">
      {(["trip", "lived"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
            value === k ? "bg-accent-soft text-accent ring-1 ring-accent" : "text-muted hover:text-ink"
          )}
        >
          {k === "trip" ? <Plane size={15} aria-hidden /> : <Home size={15} aria-hidden />}
          {k === "trip" ? "Trip" : "Lived here"}
        </button>
      ))}
    </div>
  );
}
