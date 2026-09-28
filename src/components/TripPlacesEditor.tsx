"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, MapPin, PenLine, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { orderStops } from "@/lib/tripPlaces";
import type { Place } from "@/lib/places";
import type { CountryCity } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

type Spot = { lat: number; lng: number };

/** Towns in the trip's country matching what's typed, so a place lands on the map. */
function usePlaceSearch(query: string, countryCode: string) {
  const [hits, setHits] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
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
        if (id === request.current) setHits((data.places ?? []).filter((p) => p.countryCode === countryCode));
      } catch {
        if (id === request.current) setHits([]);
      } finally {
        if (id === request.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, countryCode]);
  return { hits, searching };
}

/** A place search box: pick a suggestion (on the map), or keep what you typed. */
function PlaceSearch({
  id,
  countryCode,
  placeholder,
  initial = "",
  autoFocus,
  submitLabel,
  onPick,
  onCancel,
}: {
  id: string;
  countryCode: string;
  placeholder: string;
  initial?: string;
  autoFocus?: boolean;
  submitLabel: string;
  onPick: (name: string, spot?: Spot) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState(initial);
  // Searching starts once they type — not for the name that's already there.
  const [typed, setTyped] = useState(false);
  const { hits, searching } = usePlaceSearch(typed ? query : "", countryCode);

  async function pick(name: string, spot?: Spot) {
    if (await onPick(name, spot)) {
      setQuery("");
      setTyped(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (hits[0]) void pick(hits[0].name, { lat: hits[0].lat, lng: hits[0].lng });
        else void pick(query);
      }}
      className="relative"
    >
      <MapPin size={15} className="pointer-events-none absolute left-3 top-[1.15rem] -translate-y-1/2 text-muted" aria-hidden />
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">{placeholder}</label>
        <input
          id={id}
          className="field min-w-0 flex-1 !py-2 !pl-9 text-sm"
          placeholder={placeholder}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setTyped(true);
          }}
          onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
          autoComplete="off"
        />
        <button type="submit" aria-label={submitLabel} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line hover:border-accent hover:text-accent">
          {searching ? <Loader2 size={16} className="animate-spin" /> : onCancel ? <Check size={16} /> : <Plus size={16} />}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink">
            <X size={16} />
          </button>
        )}
      </div>
      {hits.length > 0 && (
        <ul className="absolute left-0 right-11 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => pick(h.name, { lat: h.lat, lng: h.lng })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-raised">
                <span className="font-medium">{h.name}</span>
                {h.region && <span className="truncate text-xs text-muted">{h.region}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

/**
 * The places of one trip, in journey order: search for a town (so it lands
 * on the map), give each its own dates, fix a name the photos got wrong,
 * move them up and down, remove them.
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
  const [editing, setEditing] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<CountryCity | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Places can also arrive from elsewhere on the page (photos from somewhere new).
  const initialKey = initial.map((c) => `${c.id}:${c.city_name}:${c.arrived}:${c.departed}:${c.position}`).join("|");
  useEffect(() => {
    setPlaces(orderStops(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  async function add(name: string, spot?: Spot) {
    const clean = name.trim().slice(0, 80);
    if (!clean) return false;
    setError(null);
    const position = places.length ? Math.max(...places.map((p) => p.position)) + 1 : 0;
    const { data, error: err } = await supabase
      .from("country_cities")
      .insert({ visited_country_id: visitedCountryId, country_visit_id: visitId, city_name: clean, position, lat: spot?.lat ?? null, lng: spot?.lng ?? null })
      .select("*")
      .single();
    if (err || !data) {
      setError("Could not add that place. Try again.");
      return false;
    }
    setPlaces((cur) => [...cur, data as CountryCity]);
    router.refresh();
    return true;
  }

  // The right town for a place — its days and photos stay with it.
  async function rename(id: string, name: string, spot?: Spot) {
    const clean = name.trim().slice(0, 80);
    if (!clean) return false;
    setError(null);
    const next = { city_name: clean, lat: spot?.lat ?? null, lng: spot?.lng ?? null };
    const { error: err } = await supabase.from("country_cities").update(next).eq("id", id);
    if (err) {
      setError("Could not change that place. Try again.");
      return false;
    }
    setPlaces((cur) => cur.map((p) => (p.id === id ? { ...p, ...next } : p)));
    setEditing(null);
    router.refresh();
    return true;
  }

  async function remove() {
    if (!toRemove) return;
    const id = toRemove.id;
    setToRemove(null);
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
            <li key={p.id} className="space-y-2.5 rounded-xl border border-line bg-raised p-3">
              {editing === p.id ? (
                <PlaceSearch
                  id={`rename-${p.id}`}
                  countryCode={countryCode}
                  placeholder={`The right place instead of ${p.city_name}`}
                  initial={p.city_name}
                  autoFocus
                  submitLabel="Save place"
                  onPick={(name, spot) => rename(p.id, name, spot)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setEditing(p.id)}
                    aria-label={`Change ${p.city_name}`}
                    className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium"
                  >
                    <span className="truncate">{p.city_name}</span>
                    <PenLine size={13} className="shrink-0 text-muted group-hover:text-accent" aria-hidden />
                    {p.lat == null && <span className="shrink-0 text-xs font-normal text-muted">(not on the map)</span>}
                  </button>
                  <button type="button" aria-label={`Move ${p.city_name} earlier`} disabled={i === 0} onClick={() => move(p.id, -1)} className="p-1 text-muted hover:text-ink disabled:opacity-30">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" aria-label={`Move ${p.city_name} later`} disabled={i === places.length - 1} onClick={() => move(p.id, 1)} className="p-1 text-muted hover:text-ink disabled:opacity-30">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" aria-label={`Remove ${p.city_name}`} onClick={() => setToRemove(p)} className="p-1 text-muted hover:text-red-700">
                    <X size={15} />
                  </button>
                </div>
              )}
              {/* The same date fields as the trip's own. */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  aria-label={`Arrived in ${p.city_name}`}
                  title="Arrived"
                  className="field min-w-[9rem] flex-1 !py-2 text-sm"
                  value={p.arrived ?? ""}
                  onChange={(e) => setDates(p.id, "arrived", e.target.value)}
                />
                <input
                  type="date"
                  aria-label={`Left ${p.city_name}`}
                  title="Left"
                  className="field min-w-[9rem] flex-1 !py-2 text-sm"
                  value={p.departed ?? ""}
                  onChange={(e) => setDates(p.id, "departed", e.target.value)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <PlaceSearch id="place-search" countryCode={countryCode} placeholder="Add a place - e.g. Bled" submitLabel="Add place" onPick={add} />
      {error && <p role="alert" className="text-xs text-red-800 dark:text-red-400">{error}</p>}

      <ConfirmDialog
        open={!!toRemove}
        title={`Remove ${toRemove?.city_name ?? "this place"}?`}
        body="Its photos stay in the trip - they just won't be under a place."
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
