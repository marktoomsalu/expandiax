// The pure parts of saving a found world (lib/worldScan's saveWorld): which
// countries it puts on the map, and whether a found trip is one already saved.

import { countryByCode } from "@/lib/countries";
import type { KeptTrip, KeptWorld } from "@/lib/worldScan";

/** The countries a kept world puts on the map: home first, then each trip's and event's. */
export function keptCountries(world: KeptWorld): string[] {
  const codes = [...(world.homeCode ? [world.homeCode] : []), ...world.trips.map((t) => t.code), ...(world.countries ?? []), ...(world.events ?? []).map((e) => e.code)];
  return [...new Set(codes)].filter((c) => !!countryByCode(c));
}

export type ExistingVisit = { visited_country_id: string; year: number; visited_from: string | null; visited_to: string | null };

/** Whether a found trip is one already saved (same country, overlapping dates or the same year with no dates). */
export function alreadySaved(trip: KeptTrip, visits: ExistingVisit[]): boolean {
  return visits.some((v) => {
    if (v.visited_from) {
      const to = v.visited_to ?? v.visited_from;
      return v.visited_from <= trip.to && to >= trip.from;
    }
    return v.year === Number(trip.from.slice(0, 4));
  });
}
