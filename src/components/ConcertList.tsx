"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import type { Concert, ConcertMedia } from "@/lib/types";
import { countryByCode } from "@/lib/countries";
import { RatingStars } from "./Rating";
import { formatDate } from "@/lib/utils";

type Row = Concert & { concert_media: ConcertMedia[] };

export function ConcertList({ concerts, hrefBase, editable }: { concerts: Row[]; hrefBase: string; editable?: boolean }) {
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState("all");
  const [year, setYear] = useState("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "top">("newest");

  const artists = useMemo(() => [...new Set(concerts.map((c) => c.artist_name))].sort(), [concerts]);
  const years = useMemo(
    () => [...new Set(concerts.map((c) => c.concert_date.slice(0, 4)))].sort().reverse(),
    [concerts]
  );
  const countries = useMemo(
    () => [...new Map(concerts.map((c) => [c.country_code, c.country_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [concerts]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = concerts.filter((c) => {
      if (artist !== "all" && c.artist_name !== artist) return false;
      if (year !== "all" && !c.concert_date.startsWith(year)) return false;
      if (country !== "all" && c.country_code !== country) return false;
      if (q && ![c.artist_name, c.concert_name, c.venue, c.city, c.country_name].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "top") return (b.rating ?? 0) - (a.rating ?? 0) || b.concert_date.localeCompare(a.concert_date);
      return sort === "newest"
        ? b.concert_date.localeCompare(a.concert_date)
        : a.concert_date.localeCompare(b.concert_date);
    });
  }, [concerts, query, artist, year, country, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-56">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Search concerts" placeholder="Search artist, venue, city…" className="field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <select aria-label="Filter by artist" className="field !w-auto" value={artist} onChange={(e) => setArtist(e.target.value)}>
            <option value="all">All artists</option>
            {artists.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select aria-label="Filter by year" className="field !w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select aria-label="Filter by country" className="field !w-auto" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="all">All countries</option>
            {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <select aria-label="Sort concerts" className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="top">Highest rated</option>
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No concerts match those filters.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => {
            const cover =
              c.concert_media.find((m) => m.id === c.cover_media_id) ??
              c.concert_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order)[0];
            const meta = countryByCode(c.country_code);
            return (
              <li key={c.id}>
                <Link href={`${hrefBase}/${c.id}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[3/4] bg-ink/90">
                    {cover ? (
                      <Image
                        src={cover.public_url}
                        alt={cover.caption || `${c.artist_name} live`}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center font-serif text-2xl italic text-canvas/90 dark:text-ink/90">
                        {c.artist_name}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" aria-hidden />
                    {c.is_favourite && (
                      <span className="absolute left-3 top-3 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-accent">Favourite</span>
                    )}
                    {editable && !c.is_public && (
                      <span className="absolute right-3 top-3 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted">Private</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 text-white">
                      <p className="font-serif text-xl leading-snug drop-shadow-sm">{c.artist_name}</p>
                      {c.concert_name && <p className="text-sm italic text-white/80">{c.concert_name}</p>}
                      <p className="mt-1.5 text-xs text-white/75">
                        {formatDate(c.concert_date)} · {[c.city, meta?.name].filter(Boolean).join(", ")}
                      </p>
                      <div className="mt-2"><RatingStars value={c.rating} /></div>
                    </div>
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
