"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COUNTRIES, TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { OdometerCounter } from "./OdometerCounter";

export function CountryGridStep({ homeCode, onDone }: { homeCode: string; onDone: (codes: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const home = countryByCode(homeCode);

  // Same continent as home first (the closest this codebase can get to true
  // geographic-neighbor ordering without a dedicated dataset — see
  // onboarding-brief.md §3, Screen 3A), then everything else alphabetically.
  const ordered = useMemo(() => {
    const rest = COUNTRIES.filter((c) => c.code !== homeCode);
    const sameContinent = home ? rest.filter((c) => c.continent === home.continent) : [];
    const others = home ? rest.filter((c) => c.continent !== home.continent) : rest;
    sameContinent.sort((a, b) => a.name.localeCompare(b.name));
    others.sort((a, b) => a.name.localeCompare(b.name));
    return [...sameContinent, ...others];
  }, [homeCode, home]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((c) => c.name.toLowerCase().includes(q));
  }, [ordered, query]);

  function toggle(code: string) {
    tapLight();
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  const allCodes = [homeCode, ...selected];
  const pct = Math.round((allCodes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const continents = continentCounts(allCodes).filter((c) => c.visited > 0).length;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-6 py-10">
      <p className="eyebrow text-center">Step 3</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">Where have you been?</h1>

      <div className="sticky top-0 z-10 mt-6 bg-canvas/95 py-3 text-center backdrop-blur">
        <p className="flex items-baseline justify-center gap-2 stat-number">
          <OdometerCounter value={allCodes.length} /> <span className="text-xl">countries</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {pct}% of the world · {continents} continent{continents === 1 ? "" : "s"}
        </p>
      </div>

      <div className="relative mt-4">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          aria-label="Search countries"
          placeholder="Search countries…"
          className="field !pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {shown.map((c) => {
          const isSelected = selected.includes(c.code);
          return (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => toggle(c.code)}
                aria-pressed={isSelected}
                aria-label={`${c.name}${isSelected ? ", selected" : ""}`}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-card border px-2 py-3 text-center transition-colors",
                  isSelected ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50"
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {c.flag}
                </span>
                <span className="line-clamp-1 text-[0.6875rem] text-muted">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-6 mt-8 flex justify-center">
        <button type="button" onClick={() => onDone(selected)} className="btn-accent px-8 shadow-lg">
          Continue with {allCodes.length} pin{allCodes.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
