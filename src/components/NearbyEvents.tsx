"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Pencil, RotateCcw, X } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import type { Place } from "@/lib/places";
import { EventCarousel, type CarouselCard } from "./EventCarousel";

// "Happening near …" — starts where the connection says you are, and the
// place name can be tapped to look somewhere else. That choice lives only in
// this page view: next time the feed opens, it's back to your location.
export function NearbyEvents({ initialCards, initialPlace }: { initialCards: CarouselCard[]; initialPlace: string | null }) {
  const [place, setPlace] = useState(initialPlace);
  const [cards, setCards] = useState(initialCards);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    if (!editing || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`);
        const data = (await res.json()) as { places?: Place[] };
        if (id === request.current) setSuggestions(data.places ?? []);
      } catch {
        if (id === request.current) setSuggestions([]);
      } finally {
        if (id === request.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [editing, query]);

  async function choose(p: Place) {
    setEditing(false);
    setQuery("");
    setSuggestions([]);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/events/nearby?lat=${p.lat}&lng=${p.lng}`);
      const data = (await res.json()) as { cards?: CarouselCard[]; error?: string };
      if (!res.ok) throw new Error(data.error);
      setPlace(p.name);
      setCards(data.cards ?? []);
    } catch {
      setError(`Couldn't load events near ${p.name}. Try again in a moment.`);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPlace(initialPlace);
    setCards(initialCards);
    setError(null);
  }

  const moved = place !== initialPlace;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-serif text-xl">
          {place ? (
            <>
              Happening near{" "}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-baseline gap-1 underline decoration-accent/50 decoration-dotted underline-offset-4 hover:text-accent"
                aria-label={`Happening near ${place}. Change place`}
              >
                {place}
                <Pencil size={13} className="self-center text-accent" aria-hidden />
              </button>
            </>
          ) : (
            "Happening near you"
          )}
        </h3>
        {moved && !editing && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            <RotateCcw size={12} aria-hidden /> {initialPlace ? `Back to ${initialPlace}` : "Back"}
          </button>
        )}
      </div>

      {(editing || !place) && (
        <div className="relative mb-4">
          <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            autoFocus={editing}
            className="field !pl-9 !pr-9"
            placeholder="Type a city - e.g. Bologna"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && suggestions[0]) {
                e.preventDefault();
                void choose(suggestions[0]);
              }
            }}
            aria-label="City"
          />
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label="Cancel"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
            </button>
          )}
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
              {suggestions.map((p) => {
                const country = countryByCode(p.countryCode);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => void choose(p)}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-raised"
                    >
                      <span aria-hidden>{country?.flag}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="truncate text-xs text-muted">{[p.region, country?.name].filter(Boolean).join(", ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden /> Finding what&rsquo;s on…
        </div>
      ) : error ? (
        <p role="alert" className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{error}</p>
      ) : cards.length > 0 ? (
        <EventCarousel key={place ?? ""} cards={cards} filter label={`Events near ${place ?? "you"}`} />
      ) : place ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Nothing on Ticketmaster near {place} in the next 3 months.{" "}
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-accent hover:underline">
            Try another city
          </button>
        </p>
      ) : null}

      {cards.length > 0 && !loading && <p className="mt-2 text-[11px] text-muted">Events from Ticketmaster</p>}
    </div>
  );
}
