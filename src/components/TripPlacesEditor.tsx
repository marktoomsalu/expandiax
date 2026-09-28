"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, MapPin, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { orderStops } from "@/lib/tripPlaces";
import type { Place } from "@/lib/places";
import type { CountryCity } from "@/lib/types";

/**
 * The places of one trip, in journey order: search for a city (so it lands
 * on the map), give each its own dates, move them up and down, remove them.
 */
export function TripPlacesEditor({
  visitId,
  visitedCountryId,
  countryCode,
  initial,
}: {
  visitId: string;
  visitedCountryId: string;
  countryCode: string;
  initial: CountryCity[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [places, setPlaces] = useState(() => orderStops(initial));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const id = ++request.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { places?: Place[] };
        // Places in this trip's country first; others only if nothing matches there.
        const all = data.places ?? [];
        const here = all.filter((p) => p.countryCode === countryCode);
        if (id === request.current) setHits(here.length ? here : []);
      } catch {
        if (id === request.current) setHits([]);
      } finally {
        if (id === request.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, countryCode]);

  async function add(name: string, spot?: { lat: number; lng: number }) {
    const clean = name.trim().slice(0, 80);
    if (!clean) return;
    setError(null);
    const position = places.length ? Math.max(...places.map((p) => p.position)) + 1 : 0;
    const { data, error: err } = await supabase
      .from("country_cities")
      .insert({ visited_country_id: visitedCountryId, country_visit_id: visitId, city_name: clean, position, lat: spot?.lat ?? null, lng: spot?.lng ?? null })
      .select("*")
      .single();
    if (err || !data) {
      setError("Could not add that place. Try again.");
      return;
    }
    setPlaces((cur) => [...cur, data as CountryCity]);
    setQuery("");
    setHits([]);
    router.refresh();
  }

  async function remove(id: string) {
    setPlaces((cur) => cur.filter((p) => p.id !== id));
    await supabase.from("country_cities").delete().eq("id", id);
    router.refresh();
  }

  async function setDates(id: string, field: "arrived" | "departed", value: string) {
    const place = places.find((p) => p.id === id);
    if (!place) return;
    const next = { ...place, [field]: value || null };
    if (next.arrived && next.departed && next.departed < next.arrived) {
      setError("A place can't be left before it's arrived at.");
      return;
    }
    setError(null);
    setPlaces((cur) => cur.map((p) => (p.id === id ? next : p)));
    await supabase.from("country_cities").update({ [field]: value || null }).eq("id", id);
    router.refresh();
  }

  async function move(id: string, dir: -1 | 1) {
    const i = places.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= places.length) return;
    const reordered = [...places];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const withPositions = reordered.map((p, n) => ({ ...p, position: n }));
    setPlaces(withPositions);
    await Promise.all(withPositions.map((p) => supabase.from("country_cities").update({ position: p.position }).eq("id", p.id)));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {places.length > 0 && (
        <ol className="space-y-2">
          {places.map((p, i) => (
            <li key={p.id} className="rounded-xl border border-line bg-raised px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.city_name}
                  {p.lat == null && <span className="ml-1.5 text-xs font-normal text-muted">(not on the map)</span>}
                </span>
                <button type="button" aria-label={`Move ${p.city_name} earlier`} disabled={i === 0} onClick={() => move(p.id, -1)} className="p-1 text-muted hover:text-ink disabled:opacity-30">
                  <ArrowUp size={15} />
                </button>
                <button type="button" aria-label={`Move ${p.city_name} later`} disabled={i === places.length - 1} onClick={() => move(p.id, 1)} className="p-1 text-muted hover:text-ink disabled:opacity-30">
                  <ArrowDown size={15} />
                </button>
                <button type="button" aria-label={`Remove ${p.city_name}`} onClick={() => remove(p.id)} className="p-1 text-muted hover:text-red-700">
                  <X size={15} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 pl-8">
                <label className="text-[11px] text-muted">
                  Arrived
                  <input type="date" className="field mt-0.5 !py-1.5 text-sm" value={p.arrived ?? ""} onChange={(e) => setDates(p.id, "arrived", e.target.value)} />
                </label>
                <label className="text-[11px] text-muted">
                  Left
                  <input type="date" className="field mt-0.5 !py-1.5 text-sm" value={p.departed ?? ""} onChange={(e) => setDates(p.id, "departed", e.target.value)} />
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void add(hits[0].name, { lat: hits[0].lat, lng: hits[0].lng });
          else void add(query);
        }}
        className="relative"
      >
        <MapPin size={15} className="pointer-events-none absolute left-3 top-[1.15rem] -translate-y-1/2 text-muted" aria-hidden />
        <div className="flex items-center gap-2">
          <label htmlFor="place-search" className="sr-only">Add a place</label>
          <input
            id="place-search"
            className="field min-w-0 flex-1 !py-2 !pl-9 text-sm"
            placeholder="Add a place - e.g. Bled"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" aria-label="Add place" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line hover:border-accent hover:text-accent">
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="absolute left-0 right-11 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => add(h.name, { lat: h.lat, lng: h.lng })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-raised">
                  <span className="font-medium">{h.name}</span>
                  {h.region && <span className="truncate text-xs text-muted">{h.region}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      {error && <p role="alert" className="text-xs text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}
