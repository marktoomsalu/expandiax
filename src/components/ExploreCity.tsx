"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, LocateFixed, MapPin } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import type { Place } from "@/lib/places";

/**
 * "📍 Bologna ▾" — the city Explore is about. Picking another city only
 * changes this page's address; nothing is saved, so next time it's back to
 * where you are.
 */
export function ExploreCity({ place, picked }: { place: string | null; picked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = ++request.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`);
        const data = (await res.json()) as { places?: Place[] };
        if (id === request.current) setHits(data.places ?? []);
      } catch {
        if (id === request.current) setHits([]);
      } finally {
        if (id === request.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function go(p: Place) {
    const qs = new URLSearchParams({ city: p.name, lat: String(p.lat), lng: String(p.lng), ...(p.countryCode ? { cc: p.countryCode } : {}) });
    setOpen(false);
    setQuery("");
    router.push(`/explore?${qs}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-accent"
      >
        <MapPin size={15} className="text-accent" aria-hidden />
        {place ?? "Choose a city"}
        <ChevronDown size={15} className="text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-line bg-surface p-3 shadow-xl">
          <div className="relative">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="field !pr-9"
              placeholder="Type a city - e.g. Bologna"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && hits[0]) {
                  e.preventDefault();
                  go(hits[0]);
                }
              }}
              aria-label="City"
            />
            {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
          </div>
          {hits.length > 0 && (
            <ul className="mt-2">
              {hits.map((p) => {
                const country = countryByCode(p.countryCode);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => go(p)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-raised">
                      <span aria-hidden>{country?.flag}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="truncate text-xs text-muted">{[p.region, country?.name].filter(Boolean).join(", ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {picked && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/explore");
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-accent hover:bg-raised"
            >
              <LocateFixed size={15} aria-hidden /> Back to where I am
            </button>
          )}
        </div>
      )}
    </div>
  );
}
