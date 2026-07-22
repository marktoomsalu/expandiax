"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import type { Event, EventMedia, EventType } from "@/lib/types";
import { countryByCode } from "@/lib/countries";
import { EVENT_TYPES, eventTypeMeta } from "@/lib/events";
import { RatingStars } from "./Rating";
import { formatDate } from "@/lib/utils";

type Row = Event & { event_media: EventMedia[] };

export function EventList({ events, hrefBase, editable }: { events: Row[]; hrefBase: string; editable?: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | EventType>("all");
  const [year, setYear] = useState("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "top">("newest");

  const years = useMemo(
    () => [...new Set(events.map((e) => e.event_date.slice(0, 4)))].sort().reverse(),
    [events]
  );
  const countries = useMemo(
    () => [...new Map(events.map((e) => [e.country_code, e.country_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [events]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = events.filter((e) => {
      if (type !== "all" && e.event_type !== type) return false;
      if (year !== "all" && !e.event_date.startsWith(year)) return false;
      if (country !== "all" && e.country_code !== country) return false;
      if (q && ![e.title, e.subtitle, e.venue, e.city, e.country_name].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "top") return (b.rating ?? 0) - (a.rating ?? 0) || b.event_date.localeCompare(a.event_date);
      return sort === "newest"
        ? b.event_date.localeCompare(a.event_date)
        : a.event_date.localeCompare(b.event_date);
    });
  }, [events, query, type, year, country, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-56">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Search events" placeholder="Search title, venue, city…" className="field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <select aria-label="Filter by type" className="field !w-auto" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">All types</option>
            {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select aria-label="Filter by year" className="field !w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select aria-label="Filter by country" className="field !w-auto" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="all">All countries</option>
            {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <select aria-label="Sort events" className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="top">Highest rated</option>
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No events match those filters.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => {
            const cover =
              e.event_media.find((m) => m.id === e.cover_media_id) ??
              e.event_media.filter((m) => m.media_type === "image").sort((a, b) => a.display_order - b.display_order)[0];
            const meta = countryByCode(e.country_code);
            const typeMeta = eventTypeMeta(e.event_type);
            const TypeIcon = typeMeta.icon;
            return (
              <li key={e.id}>
                <Link href={`${hrefBase}/${e.id}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[3/4] bg-ink/90">
                    {cover ? (
                      <Image
                        src={cover.public_url}
                        alt={cover.caption || e.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : e.spotify_artist_image ? (
                      <Image
                        src={e.spotify_artist_image}
                        alt={e.spotify_artist_name || e.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center font-serif text-2xl italic text-canvas/90 dark:text-ink/90">
                        {e.title}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" aria-hidden />
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted">
                      <TypeIcon size={11} /> {typeMeta.label}
                    </span>
                    {e.is_favourite && (
                      <span className="absolute right-3 top-3 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-accent">Favourite</span>
                    )}
                    {editable && !e.is_public && (
                      <span className="absolute right-3 top-10 rounded-full bg-canvas/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted">Private</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 text-white">
                      <p className="font-serif text-xl leading-snug drop-shadow-sm">{e.title}</p>
                      {e.subtitle && <p className="text-sm italic text-white/80">{e.subtitle}</p>}
                      <p className="mt-1.5 text-xs text-white/75">
                        {formatDate(e.event_date)} · {[e.city, meta?.name].filter(Boolean).join(", ")}
                      </p>
                      <div className="mt-2"><RatingStars value={e.rating} /></div>
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
