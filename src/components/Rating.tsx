"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, size = 15 }: { value: number | null; size?: number }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden
          className={n <= value ? "fill-accent text-accent" : "text-line"}
        />
      ))}
    </span>
  );
}

export function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating from 1 to 5" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="rounded p-1"
        >
          <Star
            size={22}
            className={cn(
              "transition-colors",
              value && n <= value ? "fill-accent text-accent" : "text-line hover:text-accent"
            )}
          />
        </button>
      ))}
    </div>
  );
}
