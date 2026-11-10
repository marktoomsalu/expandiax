"use client";

import { useState } from "react";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Year = { year: number; countries: number; events: number };

/**
 * Countries and events per year as two bars, no numbers until you ask:
 * tap (or hover) a year to see its counts.
 */
export function YearByYear({ years }: { years: Year[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const maxCountries = Math.max(1, ...years.map((y) => y.countries));
  const maxEvents = Math.max(1, ...years.map((y) => y.events));

  return (
    <>
      <ul className="mt-4 space-y-1">
        {[...years].reverse().map((y) => {
          const shown = open === y.year;
          return (
            <li key={y.year}>
              <button
                type="button"
                onClick={() => {
                  tapLight();
                  setOpen(shown ? null : y.year);
                }}
                onMouseEnter={() => setOpen(y.year)}
                onMouseLeave={() => setOpen((o) => (o === y.year ? null : o))}
                aria-expanded={shown}
                aria-label={`${y.year}: ${y.countries} ${y.countries === 1 ? "country" : "countries"}, ${y.events} ${y.events === 1 ? "event" : "events"}`}
                className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors", shown && "bg-raised")}
              >
                <span className={cn("w-11 shrink-0 tabular-nums", shown ? "font-medium text-ink" : "text-muted")}>{y.year}</span>
                <span className="flex-1">
                  <span className="block space-y-1.5">
                    <Bar value={y.countries} max={maxCountries} tone="bg-accent" />
                    <Bar value={y.events} max={maxEvents} tone="bg-ink/35" />
                  </span>
                  {shown && (
                    <span className="mt-1.5 flex gap-3 text-xs font-medium">
                      <span className="text-accent">{count(y.countries, "country", "countries")}</span>
                      <span className="text-ink/70">{count(y.events, "event", "events")}</span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-4 px-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" /> Countries</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-ink/35" /> Events</span>
        <span className="ml-auto">Tap a year for numbers</span>
      </p>
    </>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <span className="block h-3 overflow-hidden rounded-full bg-raised">
      <span className={cn("block h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${value ? Math.max(4, (value / max) * 100) : 0}%` }} />
    </span>
  );
}
