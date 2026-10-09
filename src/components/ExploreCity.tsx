"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, LocateFixed, MapPin } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import type { Place } from "@/lib/places";

/**
 * "📍 Bologna ▾" — the city Explore is about, followed by `children` (the
 * search field) until it's tapped. Picking another city only
 * changes this page's address; nothing is saved, so next time it's back to
 * where you are.
 */
export function ExploreCity({ place, picked, children }: { place: string | null; picked: boolean; children?: React.ReactNode }) {
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
    close();
    router.push(`/explore?${qs}`);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  // Choosing a city takes over the row (in place of the city and the
  // search field), with suggestions below it in the page — not a second
  // search box floating over the first.
  if (open) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MapPin size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent" aria-hidden />
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="field !rounded-full !py-2.5 !pl-11 !pr-10"
              placeholder="Type a city - e.g. Bologna"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter" && hits[0]) {
                  e.preventDefault();
                  go(hits[0]);
                }
              }}
              aria-label="City"
            />
            {busy && <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
          </div>
          <button type="button" onClick={close} className="shrink-0 px-2 py-2.5 text-sm font-medium text-muted hover:text-ink">
            Cancel
          </button>
        </div>
        {(hits.length > 0 || picked) && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-sm">
            {hits.map((p) => {
              const country = countryByCode(p.countryCode);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => go(p)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-raised">
                    <span aria-hidden>{country?.flag}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="truncate text-xs text-muted">{[p.region, country?.name].filter(Boolean).join(", ")}</span>
                  </button>
                </li>
              );
            })}
            {picked && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    router.push("/explore");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-accent hover:bg-raised"
                >
                  <LocateFixed size={15} aria-hidden /> Back to where I am
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-accent"
      >
        <MapPin size={15} className="text-accent" aria-hidden />
        {place ?? "Choose a city"}
        <ChevronDown size={15} className="text-muted" aria-hidden />
      </button>
      {children}
    </>
  );
}
