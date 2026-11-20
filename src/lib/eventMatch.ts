// "Find my world", events: was this evening of photos a concert, a match,
// a show? On the phone, a moment (a few hours of photos in one spot) is
// checked against the venues around it (Wikidata, CC0, public/data/venues);
// only then are the day, the town and those venues' names (no place, no
// photo, nothing about the person) checked against what played there that
// day (setlist.fm). The pure parts live here, so they're tested.

import type { EventType } from "./types";

/** s stadium, a indoor arena, m concert hall / music venue / opera, t theatre / amphitheatre. */
export type VenueKind = "s" | "a" | "m" | "t";
export type Venue = { name: string; lat: number; lng: number; kind: VenueKind; /** Other names it goes by ("San Siro" for Giuseppe Meazza Stadium). */ aka: string[] };

/** What the phone asks the server about one moment. */
export type MomentQuery = {
  id: string;
  /** yyyy-mm-dd, local. */
  day: string;
  /** The town it's in (from the phone's own town list). */
  city: string | null;
  countryCode: string | null;
  /** Venues within a few hundred metres, nearest first. */
  venues: { name: string; kind: VenueKind; aka?: string[] }[];
  photos: number;
  hours: number;
};

export type MatchedEvent = {
  id: string;
  type: EventType;
  title: string;
  artist: string | null;
  venue: string | null;
  /** Sure: a show and the venue agree. Not sure: only the place says so. */
  sure: boolean;
};

export type Show = { artist: string; venue: string | null; city: string | null; countryCode: string | null };

/** A country's venues from /data/venues/XX.json rows: [name, lat, lng, kind, other names?]. */
export function venuesFromRows(rows: [string, number, number, string, string[]?][]): Venue[] {
  return rows.flatMap(([name, lat, lng, kind, aka]) => ("satm".includes(kind) && name ? [{ name, lat, lng, kind: kind as VenueKind, aka: Array.isArray(aka) ? aka : [] }] : []));
}

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * Venues near a moment, nearest first. A stadium's point can sit in the
 * middle of its pitch, a few hundred metres from the stands, so big venues
 * reach further than small ones.
 */
export function venuesNear(m: { lat: number; lng: number }, venues: Venue[]): Venue[] {
  const reach: Record<VenueKind, number> = { s: 450, a: 350, m: 250, t: 200 };
  return venues
    .map((v) => ({ v, d: metres(m, v) }))
    .filter((x) => x.d <= reach[x.v.kind])
    .sort((a, b) => a.d - b.d)
    .map((x) => x.v);
}

// Words that say what kind of place it is, not which: they can't make two names "the same".
const GENERIC = new Set(
  "the a an of de di da del della des du la le les el il lo der die das and arena stadium stadion stadio estadio stade theatre theater teatro teatr hall halle sala club centre center centro music park parco parque festival fest live auditorium opera house"
    .split(" ")
);
const words = (s: string) =>
  s
    // "Unipol Arena (Casalecchio di Reno)": what's in brackets is where, not which.
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Whether two venue names are the same place ("The O2" and "The O2 Arena", "Verona Arena" and "Arena di Verona"). */
export function sameVenue(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  const ka = new Set(wa.filter((w) => !GENERIC.has(w)));
  const kb = new Set(wb.filter((w) => !GENERIC.has(w)));
  if (!ka.size || !kb.size) return wa.join(" ") === wb.join(" ");
  let shared = 0;
  for (const w of ka) if (kb.has(w)) shared += 1;
  // Most of the telling words in common, counted against the longer name:
  // "The O2" is "The O2 Arena", but not "O2 Academy Brixton".
  return shared / Math.max(ka.size, kb.size) >= 0.5;
}

/**
 * What a moment was, from the venues around it and the shows in its town
 * that day. A show at a venue right there is sure; a lone stadium or stage
 * with no listed show is offered, not assumed (the person decides).
 */
export function decide(moment: MomentQuery, shows: Show[]): MatchedEvent | null {
  const near = moment.venues;
  for (const v of near) {
    const names = [v.name, ...(v.aka ?? [])];
    const show = shows.find((s) => s.venue && names.some((n) => sameVenue(s.venue!, n)));
    if (show) {
      // The venue as people (and the listing) call it: "Stadio San Siro", not its official name.
      return { id: moment.id, type: /festival/i.test(show.venue ?? "") ? "festival" : "concert", title: show.artist, artist: show.artist, venue: show.venue, sure: true };
    }
  }
  // A festival: a long day with lots of photos, and a festival on the town's list that day.
  const festival = shows.find((s) => /festival|fest\b/i.test(s.venue ?? ""));
  if (festival && moment.hours >= 3 && moment.photos >= 20) {
    return { id: moment.id, type: "festival", title: festival.venue!, artist: null, venue: festival.venue, sure: false };
  }
  const v = near[0];
  if (!v) return null;
  // One show in town that night and they were at a stage or arena: probably that one.
  if (shows.length === 1 && v.kind !== "s") {
    return { id: moment.id, type: "concert", title: shows[0].artist, artist: shows[0].artist, venue: v.name, sure: false };
  }
  return { id: moment.id, type: v.kind === "s" ? "sport" : v.kind === "t" ? "other" : "concert", title: v.name, artist: null, venue: v.name, sure: false };
}
