"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CountryMeta = { code: string; name: string; flag: string };

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
  const hasVisited = visited > 0;

  return (
    <div className="card px-4 py-3">
      <button
        type="button"
        onClick={() => hasVisited && setOpen((o) => !o)}
        disabled={!hasVisited}
        aria-expanded={open}
        className={cn("flex w-full items-baseline justify-between text-sm", hasVisited && "cursor-pointer")}
      >
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {name}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          {visited} / {total}
          {hasVisited && <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />}
        </span>
      </button>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-label={`${name} progress`}
        aria-valuenow={visited}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${total ? (visited / total) * 100 : 0}%`, backgroundColor: color }} />
      </div>
      {open && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <li key={c.code}>
              <Link
                href={`/my-world/${c.code.toLowerCase()}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
              >
                <span aria-hidden>{c.flag}</span> {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
