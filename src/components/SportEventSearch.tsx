"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, Trophy, X } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import type { SportEventHit } from "@/lib/wikidata";
import { ExternalLink } from "./ExternalLink";

const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function when(h: SportEventHit) {
  if (h.date && h.endDate) return `${day(h.date)} – ${day(h.endDate)}`;
  if (h.date) return day(h.date);
  return h.year ? String(h.year) : null;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Logging a sport event: search any race, match or championship (Wikidata
// covers every sport, from Ironman and marathons to finals and Grands Prix),
// tap it, and the name, date, place and country fill in.
export function SportEventSearch({ onPick }: { onPick: (hit: SportEventHit, fields: { sport: string | null }) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SportEventHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<SportEventHit | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearched(false);
      return;
    }
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/sport-events?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { events?: SportEventHit[] };
        if (id === request.current) {
          setHits(data.events ?? []);
          setSearched(true);
        }
      } catch {
        if (id === request.current) setHits([]);
      } finally {
        if (id === request.current) setBusy(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(h: SportEventHit) {
    setPicked(h);
    setQuery("");
    setHits([]);
    onPick(h, { sport: h.sport ? capitalise(h.sport) : null });
  }

  if (picked) {
    const country = countryByCode(picked.countryCode);
    return (
      <div className="flex items-start gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm">
        <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{picked.name}</p>
          <p className="text-xs text-muted">
            {[picked.sport && capitalise(picked.sport), when(picked), country && `${country.flag} ${country.name}`].filter(Boolean).join(" · ")}
          </p>
          {!picked.date && <p className="mt-1 text-xs font-medium text-accent">Now set the date you were there.</p>}
        </div>
        <button type="button" onClick={() => setPicked(null)} className="shrink-0 text-xs text-accent hover:underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-raised px-4 py-3">
      <label htmlFor="sport-search" className="flex items-center gap-2 text-sm font-medium">
        <Trophy size={15} className="text-accent" aria-hidden /> Find the race, match or event
      </label>
      <div className="relative mt-2">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="sport-search"
          className="field !pl-9 !pr-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tallinn Marathon, Ironman, Wimbledon 2025…"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            aria-label="Clear"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
          </button>
        )}
      </div>

      {hits.length > 0 && (
        <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
          {hits.map((h) => {
            const country = countryByCode(h.countryCode);
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-accent"
                >
                  <span className="block font-medium">{h.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[h.sport && capitalise(h.sport), when(h), [h.venue, h.city].filter(Boolean).join(", ") || null, country && `${country.flag} ${country.name}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {searched && !busy && hits.length === 0 && (
        <p className="mt-2 text-xs text-muted">Nothing found - just fill in the details below.</p>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Event data from{" "}
        <ExternalLink href="https://www.wikidata.org" className="underline underline-offset-2">
          Wikidata
        </ExternalLink>
      </p>
    </div>
  );
}
