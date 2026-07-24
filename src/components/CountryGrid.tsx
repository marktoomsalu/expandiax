"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { CountryCardMedia } from "./CountryCardMedia";
import { countryByCode } from "@/lib/countries";
import type { VisitedCountry, CountryMedia } from "@/lib/types";

type VisitLite = { year: number; visited_from: string | null; visited_to: string | null };
type Row = VisitedCountry & { country_media: CountryMedia[]; country_visits: VisitLite[] };

export function CountryGrid({ countries }: { countries: Row[] }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      const meta = countryByCode(c.country_code);
      return [c.country_name, meta?.continent, meta?.capital].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [countries, query]);

  return (
    <div>
      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          aria-label="Search your countries"
          placeholder="Search your countries…"
          className="field !pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No countries match that search.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => {
            const meta = countryByCode(c.country_code);
            const cover =
              c.country_media.find((m) => m.id === c.cover_media_id) ??
              [...c.country_media].sort((a, b) => a.display_order - b.display_order)[0];
            const media = cover
              ? [cover, ...c.country_media.filter((m) => m.id !== cover.id).sort((a, b) => a.display_order - b.display_order)]
              : [];
            const years = [...new Set(c.country_visits.map((v) => v.year))].sort();
            const detail = years.length ? years.join(" · ") : "Add your visit years";
            return (
              <li key={c.id}>
                <Link href={`/my-world/${c.country_code.toLowerCase()}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[3/4] bg-raised">
                    {media.length > 0 ? (
                      <CountryCardMedia
                        media={media}
                        alt={`Photo from ${c.country_name}`}
                        flag={meta?.flag}
                        name={c.country_name}
                        detail={detail}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <span className="font-serif text-5xl opacity-60" aria-hidden>{meta?.flag}</span>
                        <div>
                          <p className="font-serif text-lg">{c.country_name}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {years.length ? years.join(" · ") : "Add your visit years"}
                          </p>
                        </div>
                      </div>
                    )}
                    {c.is_favourite && (
                      <span className="absolute left-3 top-3 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-accent">Favourite</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
