"use client";

import { useEffect, useState } from "react";
import { Camera, MapPin, X } from "lucide-react";
import type { createClient } from "@/lib/supabase/client";
import { photoDay, photoSpot } from "@/lib/photoDates";
import { groupByTown, loadTowns, townFor, type SuggestedPlace, type Town } from "@/lib/photoPlaces";
import { shortDays } from "@/lib/tripPlaces";

export type PhotoFacts = { day: string | null; spot: { lat: number; lng: number } | null; town: Town | null };

/**
 * When and where each photo was taken, read on the device — and the town
 * that is, from the trip's country's list of towns (only fetched when a
 * photo has a location at all). Nothing here is sent anywhere or stored.
 */
export async function readPhotoFacts(files: File[], countryCode: string): Promise<PhotoFacts[]> {
  const facts = await Promise.all(
    files.map(async (f) => {
      const [day, spot] = await Promise.all([photoDay(f), photoSpot(f)]);
      return { day, spot, town: null as Town | null };
    })
  );
  if (facts.some((f) => f.spot)) {
    const towns = await loadTowns(countryCode);
    for (const f of facts) if (f.spot) f.town = townFor(f.spot, towns);
  }
  return facts;
}

/** The places the chosen photos were taken in, in order, with their days. */
export function usePhotoPlaces(files: File[], countryCode: string): SuggestedPlace[] {
  const [places, setPlaces] = useState<SuggestedPlace[]>([]);
  const key = files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|");
  useEffect(() => {
    let live = true;
    if (!files.length) {
      setPlaces([]);
      return;
    }
    readPhotoFacts(files, countryCode).then((facts) => live && setPlaces(groupByTown(facts)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, countryCode]);
  return places;
}

/** Adds these places to a trip, after any it already has. Returns each one's new id by key. */
export async function savePlaces(
  supabase: ReturnType<typeof createClient>,
  opts: { visitedCountryId: string; visitId: string; places: Pick<SuggestedPlace, "key" | "name" | "lat" | "lng" | "arrived" | "departed">[]; firstPosition?: number }
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (!opts.places.length) return ids;
  const { data } = await supabase
    .from("country_cities")
    .insert(
      opts.places.map((p, i) => ({
        visited_country_id: opts.visitedCountryId,
        country_visit_id: opts.visitId,
        city_name: p.name.slice(0, 80),
        position: (opts.firstPosition ?? 0) + i,
        arrived: p.arrived,
        departed: p.departed,
        lat: p.lat,
        lng: p.lng,
      }))
    )
    .select("id, position");
  // Rows come back in insert order; position says which is which regardless.
  for (const row of data ?? []) {
    const p = opts.places[row.position - (opts.firstPosition ?? 0)];
    if (p) ids.set(p.key, row.id);
  }
  return ids;
}

/** The places found in the chosen photos, before the trip is saved — each one easy to drop. */
export function SuggestedPlacesField({ places, onRemove }: { places: SuggestedPlace[]; onRemove: (key: string) => void }) {
  if (!places.length) return null;
  return (
    <div className="border-t border-line pt-5">
      <span className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <MapPin size={14} className="text-accent" aria-hidden /> Places
      </span>
      <ol className="flex flex-wrap gap-2">
        {places.map((p, i) => {
          const days = shortDays(p.arrived, p.departed);
          return (
            <li key={p.key} className="flex items-center gap-1.5 rounded-full border border-line bg-raised py-1 pl-1 pr-1.5 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{i + 1}</span>
              <span className="font-medium">{p.name}</span>
              {days && <span className="text-xs text-muted">{days}</span>}
              <button type="button" onClick={() => onRemove(p.key)} aria-label={`Leave out ${p.name}`} className="rounded-full p-0.5 text-muted hover:text-ink">
                <X size={13} />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <Camera size={13} className="shrink-0 text-accent" aria-hidden />
        Suggested from where your photos were taken - worked out on your device, never shared.
      </p>
    </div>
  );
}
