"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, MapPin, PenLine, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { orderStops } from "@/lib/tripPlaces";
import type { Place } from "@/lib/places";
import type { CountryCity } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DateField } from "./DateField";

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
  // Adding (not renaming): what was typed can always be added as it is.
  const offerTyped = !onCancel && typed && query.trim().length >= 2 && !searching && !hits.some((h) => h.name.toLowerCase() === query.trim().toLowerCase());

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
          className="field min-w-0 flex-1 !py-2 !pl-9"
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
        {onCancel ? (
          <>
            <button type="submit" aria-label={submitLabel} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line hover:border-accent hover:text-accent">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button type="button" onClick={onCancel} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink">
              <X size={16} />
            </button>
          </>
        ) : (
          searching && <Loader2 size={16} className="absolute right-3 top-[1.15rem] -translate-y-1/2 animate-spin text-muted" aria-hidden />
        )}
      </div>
      {(hits.length > 0 || offerTyped) && (
        <ul className={cn("absolute left-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg", onCancel ? "right-11" : "right-0")}>
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => pick(h.name, { lat: h.lat, lng: h.lng })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-raised">
                <span className="font-medium">{h.name}</span>
                {h.region && <span className="truncate text-xs text-muted">{h.region}</span>}
              </button>
            </li>
          ))}
          {offerTyped && (
            <li className={cn(hits.length > 0 && "border-t border-line")}>
              {/* Somewhere the search doesn't know: keep it as typed (it won't be on the map). */}
              <button type="button" onClick={() => pick(query)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-accent hover:bg-raised">
                <Plus size={14} className="shrink-0" aria-hidden /> Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </form>
  );
}

/**
 * Places with their days in date order, each in a slot a dated place had;
 * places without days stay exactly where they are.
 */
function byDate(list: CountryCity[]): CountryCity[] {
  const dated = list.filter((p) => p.arrived).sort((a, b) => a.arrived!.localeCompare(b.arrived!));
  let n = 0;
  return list.map((p) => (p.arrived ? dated[n++] : p));
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

  // Places can also arrive from elsewhere on the page (photos from somewhere
  // new). The list keeps the order it's in on screen, so a place being
  // edited never jumps away: new ones join at the end.
  const initialKey = initial.map((c) => `${c.id}:${c.city_name}:${c.arrived}:${c.departed}:${c.position}`).join("|");
  useEffect(() => {
    setPlaces((cur) => {
      const fresh = new Map(initial.map((c) => [c.id, c]));
      const kept = cur.flatMap((p) => (fresh.has(p.id) ? [fresh.get(p.id)!] : []));
      const added = orderStops(initial.filter((c) => !cur.some((p) => p.id === c.id)));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  // Keeps a place on screen after it moves (or arrives).
  function reveal(id: string) {
    requestAnimationFrame(() => document.getElementById(`place-row-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

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
    reveal((data as CountryCity).id);
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
    const updated = places.map((p) => (p.id === id ? next : p));
    // Only once a place has both its days does it take its place in the
    // journey (by date); while the first date is being set it stays put.
    const settle = field === "departed" && !!next.arrived && !!next.departed;
    const ordered = settle ? byDate(updated) : updated;
    const moved = ordered.some((p, n) => p.id !== updated[n].id);
    setPlaces(moved ? ordered.map((p, n) => ({ ...p, position: n })) : ordered);
    await supabase.from("country_cities").update({ [field]: value || null }).eq("id", id);
    if (moved) {
      await Promise.all(ordered.map((p, n) => supabase.from("country_cities").update({ position: n }).eq("id", p.id)));
      reveal(id);
    }
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
      <PlaceSearch id="place-search" countryCode={countryCode} placeholder="Add a place - e.g. Bled" submitLabel="Add place" onPick={add} />
      {places.length > 0 && (
        <ol className="space-y-2">
          {places.map((p, i) => (
            <li key={p.id} id={`place-row-${p.id}`} className="scroll-mt-28 scroll-mb-28 space-y-2.5 rounded-xl border border-line bg-raised p-3">
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
                {/* Arrival opens where the previous place ended; leaving opens on the arrival. */}
                <DateField
                  label={`Arrived in ${p.city_name}`}
                  placeholder="Arrived"
                  className="min-w-[9rem] flex-1 !py-2"
                  value={p.arrived ?? ""}
                  openTo={places[i - 1]?.departed ?? places[i - 1]?.arrived ?? undefined}
                  clearable
                  onChange={(v) => setDates(p.id, "arrived", v)}
                />
                <DateField
                  label={`Left ${p.city_name}`}
                  placeholder="Left"
                  className="min-w-[9rem] flex-1 !py-2"
                  value={p.departed ?? ""}
                  min={p.arrived ?? undefined}
                  openTo={p.arrived ?? undefined}
                  clearable
                  onChange={(v) => setDates(p.id, "departed", v)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

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
