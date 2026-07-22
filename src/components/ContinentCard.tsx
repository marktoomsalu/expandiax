"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CountryMeta = { code: string; name: string; flag: string; visited: boolean; count: number };

export function ContinentCard({
  name,
  color,
  visited,
  total,
  countries,
}: {
  name: string;
  color: string;
  visited: number;
  total: number;
  countries: CountryMeta[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-baseline justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {name}
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            {visited} / {total}
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-raised"
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuenow={visited}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${total ? (visited / total) * 100 : 0}%`, backgroundColor: color }} />
        </div>
      </button>
      {open && (
        <ul className="flex flex-wrap gap-1.5 border-t border-line px-4 py-3">
          {countries.map((c) => (
            <li key={c.code}>
              <Link
                href={`/my-world/${c.code.toLowerCase()}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  c.visited
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:border-accent hover:text-accent"
                )}
              >
                <span aria-hidden>{c.flag}</span> {c.name}
                {c.visited && c.count > 1 && <span className="opacity-75">×{c.count}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
