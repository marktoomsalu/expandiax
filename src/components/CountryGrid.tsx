"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImagePlus, Search } from "lucide-react";
import { CountryCardMedia } from "./CountryCardMedia";
import { countryByCode } from "@/lib/countries";
import { territoryByCode, territoryFlagFor } from "@/lib/territories";
import type { StockPhoto } from "@/lib/stockPhotos";
import type { VisitedCountry, CountryMedia } from "@/lib/types";
import { StockCredit } from "./StockCredit";

type VisitLite = { year: number; visited_from: string | null; visited_to: string | null };
type Row = VisitedCountry & { country_media: CountryMedia[]; country_visits: VisitLite[] };

export function CountryGrid({ countries, stock = {} }: { countries: Row[]; stock?: Record<string, StockPhoto> }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      const meta = countryByCode(c.country_code) ?? territoryByCode(c.country_code);
      return [c.country_name, meta?.continent, meta && "capital" in meta ? meta.capital : null]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
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
            const country = countryByCode(c.country_code);
            const territory = country ? null : territoryByCode(c.country_code);
            const flag = country?.flag ?? (territory ? territoryFlagFor(territory) : undefined);
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
                        flag={flag}
                        name={c.country_name}
                        detail={detail}
                      />
                    ) : stock[c.country_code] ? (
                      // No photos of their own yet: a stock photo, clearly marked, and an invitation to add theirs.
                      <>
                        <Image
                          src={stock[c.country_code].srcSmall}
                          alt=""
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover saturate-[0.85]"
                          style={{ backgroundColor: stock[c.country_code].color }}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" aria-hidden />
                        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 text-white">
                          <p className="font-serif text-xl drop-shadow-sm">{flag} {c.country_name}</p>
                          <p className="mt-0.5 text-xs text-white/75">{detail}</p>
                          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#14110d] shadow-sm transition-transform group-hover:scale-[1.03]">
                            <ImagePlus size={13} aria-hidden /> Add your memories
                          </span>
                          <StockCredit photo={stock[c.country_code]} linked={false} className="mt-2.5 block text-white/60" />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <span className="font-serif text-5xl opacity-60" aria-hidden>{flag}</span>
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
                    {territory && (
                      <span className="absolute right-3 top-3 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted">Territory</span>
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
