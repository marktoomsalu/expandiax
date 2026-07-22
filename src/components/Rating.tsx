"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, size = 15 }: { value: number | null; size?: number }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value} out of 10`}>
      <Star size={size} aria-hidden className="fill-accent text-accent" />
      <span className="text-xs font-semibold tabular-nums text-ink">{value}/10</span>
    </span>
  );
}

export function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating from 1 to 10" className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 10`}
          onClick={() => onChange(n)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
            value === n
              ? "border-accent bg-accent text-white"
              : "border-line text-muted hover:border-accent hover:text-accent"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
