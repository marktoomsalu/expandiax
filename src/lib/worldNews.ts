// Found worlds against what someone already has: what's new, by the same
// rules saving uses (lib/worldScan's saveWorld), so nothing is saved twice.
// Pure, no database: the member's side is loaded by loadMemberWorld.

import { countryByCode } from "@/lib/countries";
import { sameVenue } from "@/lib/eventMatch";
import type { KeptEvent, KeptTrip, KeptWorld } from "@/lib/worldScan";

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

/** What a member already has, to tell found things apart from ones already saved. */
export type MemberWorld = {
  codes: string[];
  visits: Record<string, ExistingVisit[]>;
  events: { event_date: string; title: string; venue: string | null }[];
};

export type WorldNews = {
  /** Countries not in their world yet. */
  countries: string[];
  /** Trips not saved yet (in new countries or ones they have). */
  trips: KeptTrip[];
  /** Memories not saved yet. */
  events: KeptEvent[];
  /** How much was already there, skipped. */
  known: { countries: number; trips: number; events: number };
};

const sameEvent = (x: MemberWorld["events"][number], e: KeptEvent) =>
  x.event_date === e.date && ((!!e.venue && !!x.venue && sameVenue(x.venue, e.venue)) || x.title.toLowerCase() === e.title.toLowerCase());

/**
 * A found world against a member's own: only what's new (the same rules
 * saveWorld uses, so nothing shown is skipped on saving, and nothing saved
 * twice).
 */
export function worldNews(world: KeptWorld, mine: MemberWorld): WorldNews {
  const have = new Set(mine.codes);
  const all = keptCountries(world);
  const countries = all.filter((c) => !have.has(c));
  const trips = world.trips.filter((t) => !alreadySaved(t, mine.visits[t.code] ?? []));
  const events = (world.events ?? []).filter((e) => !mine.events.some((x) => sameEvent(x, e)));
  return {
    countries,
    trips,
    events,
    known: { countries: all.length - countries.length, trips: world.trips.length - trips.length, events: (world.events?.length ?? 0) - events.length },
  };
}

/** Just what they chose from the news, as a world saveWorld can write (home is never changed for a member). */
export function chosenWorld(news: WorldNews, pick: { countries: Set<string>; trips: Set<KeptTrip>; events: Set<KeptEvent> }): KeptWorld {
  return {
    homeCode: null,
    trips: news.trips.filter((t) => pick.trips.has(t)),
    countries: news.countries.filter((c) => pick.countries.has(c)),
    events: news.events.filter((e) => pick.events.has(e)),
  };
}
