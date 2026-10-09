"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { COUNTRIES, TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { OdometerCounter } from "./OdometerCounter";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[240px] w-full sm:h-[320px]" />,
});

// A brand-new account is always on the free plan, and the eventual save is
// one bulk insert in a single transaction — if selection ran past the free
// cap, the whole batch would fail at the DB trigger, losing everything
// rather than just the excess. Capping selection here avoids that outcome
// entirely instead of trying to recover from a partial/failed bulk insert.

export function CountryGridStep({
  homeCode,
  initialSelected = [],
  onDone,
}: {
  homeCode: string;
  initialSelected?: string[];
  onDone: (codes: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const home = countryByCode(homeCode);

  // Under a heading per continent, alphabetical within each, so any country
  // is easy to find by eye. Home's continent comes first (it's where most
  // people's trips start), then the rest A-Z.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rest = COUNTRIES.filter((c) => c.code !== homeCode && (!q || c.name.toLowerCase().includes(q)));
    const continents = [...new Set(COUNTRIES.map((c) => c.continent))].sort((a, b) =>
      a === home?.continent ? -1 : b === home?.continent ? 1 : a.localeCompare(b)
    );
    return continents
      .map((continent) => ({
        continent,
        countries: rest.filter((c) => c.continent === continent).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.countries.length > 0);
  }, [homeCode, home, query]);

  const allCodes = [homeCode, ...selected];

  function toggle(code: string) {
    if (code === homeCode) return; // home is fixed, not part of the toggle set
    setSelected((prev) => {
      const isSelected = prev.includes(code);
      tapLight();
      return isSelected ? prev.filter((c) => c !== code) : [...prev, code];
    });
  }

  const pct = Math.round((allCodes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const continents = continentCounts(allCodes).filter((c) => c.visited > 0).length;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-6 pb-10 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <p className="eyebrow text-center">Step 3</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">Where have you been?</h1>

      <div className="sticky top-[env(safe-area-inset-top)] z-10 mt-6 bg-canvas/95 py-3 text-center backdrop-blur">
        <p className="flex items-baseline justify-center gap-2 stat-number">
          <OdometerCounter value={allCodes.length} /> <span className="text-xl">{allCodes.length === 1 ? "country" : "countries"}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {pct}% of the world · {continents} continent{continents === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-4 w-full">
        <WorldGlobeInner visitedCodes={allCodes} homeCode={homeCode} interactive onSelect={toggle} />
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

      {groups.length === 0 && <p className="mt-6 text-center text-sm text-muted">No country matches &ldquo;{query.trim()}&rdquo;.</p>}

      {groups.map((g) => (
        <section key={g.continent} className="mt-6" aria-label={g.continent}>
          <h2 className="eyebrow mb-2.5">{g.continent}</h2>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {g.countries.map((c) => {
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
        </section>
      ))}

      <div className="sticky bottom-[calc(1.5rem+env(safe-area-inset-bottom))] mt-8 flex justify-center">
        <button type="button" onClick={() => onDone(selected)} className="btn-accent px-8 shadow-lg">
          Continue with {allCodes.length} pin{allCodes.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
