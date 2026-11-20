// "Find my world", events: was this evening of photos a concert, a match,
// a show? On the phone, a moment (a few hours of photos in one spot) is
// checked against the venues around it (Wikidata, CC0, public/data/venues).
// The server is asked only for a day, a few town names and venue names (no
// place, no photo, nothing about the person): what played at those venues
// or in those towns that day (setlist.fm), and where those venues are. The
// phone then decides whether the photos were taken there.

import type { EventType } from "./types";

/** s stadium, a indoor arena, m concert hall / music venue / opera, t theatre / amphitheatre. */
export type VenueKind = "s" | "a" | "m" | "t";
export type Venue = { name: string; lat: number; lng: number; kind: VenueKind; /** Other names it goes by ("San Siro" for Giuseppe Meazza Stadium). */ aka: string[] };

/** What the phone asks about one moment. */
export type MomentAsk = {
  id: string;
  /** yyyy-mm-dd, local. */
  day: string;
  countryCode: string | null;
  /** Town names it could be listed under ("Wembley" and "London"). */
  towns: string[];
  /** Names of the venues right there, each with its other names. */
  venues: string[];
  /** Roughly where (rounded to ~20 km, like a town name): to pick shows nearby from a whole country's list. */
  area?: { lat: number; lng: number } | null;
};

/** What the server answers: a show that day, and where its venue is (when known). */
export type ShowFound = {
  artist: string;
  venue: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  /** Found by asking for one of the venues the photos were taken at. */
  atVenue: boolean;
  /** The listed town's middle: where a venue that can't be placed is, roughly (a small place like Fornebu). */
  cityLat?: number | null;
  cityLng?: number | null;
  /** Songs played: the headliner plays the most. */
  songs?: number;
};

/** A moment as the phone knows it. */
export type Moment = { id: string; lat: number; lng: number; day: string; photos: number; hours: number; near: Venue[] };

export type Decision =
  | { kind: "event"; type: EventType; title: string; artist: string | null; venue: string | null; sure: boolean }
  /** A big day with nothing listed: the person says what it was (a race, a wedding, an unlisted show). */
  | { kind: "name"; place: string | null; venueKind: VenueKind | null }
  | null;

/** A country's venues from /data/venues/XX.json rows: [name, lat, lng, kind, other names?]. */
export function venuesFromRows(rows: [string, number, number, string, string[]?][]): Venue[] {
  return rows.flatMap(([name, lat, lng, kind, aka]) => ("satm".includes(kind) && name ? [{ name, lat, lng, kind: kind as VenueKind, aka: Array.isArray(aka) ? aka : [] }] : []));
}

export const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
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
  const reach: Record<VenueKind, number> = { s: 600, a: 450, m: 300, t: 250 };
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

/** A big day: long enough, with enough photos, to be worth asking about. */
export const isBigDay = (m: Pick<Moment, "photos" | "hours">) => (m.hours >= 2 && m.photos >= 25) || m.photos >= 60;

const concert = (show: ShowFound, sure: boolean): Decision => ({
  kind: "event",
  type: /festival|fest\b/i.test(show.venue ?? "") ? "festival" : "concert",
  title: show.artist,
  artist: show.artist,
  venue: show.venue,
  sure,
});

/** The headliner of a night: the longest setlist (support acts play a handful of songs). */
export function headliner(shows: ShowFound[]): ShowFound {
  return shows.reduce((best, s) => ((s.songs ?? 0) > (best.songs ?? 0) ? s : best), shows[0]);
}

/**
 * What a moment was. Sure: a show listed at the venue the photos were taken
 * at (asked by its name, or its listed venue found right there). A show
 * whose venue is a little further is offered; a big day at a venue with
 * nothing listed (a match, an unlisted show) or anywhere else (a race, a
 * wedding) is for the person to name.
 */
export function decide(m: Moment, shows: ShowFound[]): Decision {
  const atVenue = shows.filter((s) => s.atVenue);
  if (atVenue.length) return concert(headliner(atVenue), true);

  const names = m.near.flatMap((v) => [v.name, ...v.aka]);
  const byName = shows.filter((s) => s.venue && names.some((n) => sameVenue(s.venue!, n)));
  if (byName.length) return concert(headliner(byName), true);

  // Where each show was: its venue, or (when that can't be found) its town's
  // middle, which only counts when it's right there (a small place).
  const placed = shows.flatMap((s) => {
    if (s.lat != null && s.lng != null) return [{ s, d: metres(m, { lat: s.lat, lng: s.lng }) }];
    if (s.cityLat != null && s.cityLng != null) {
      const d = metres(m, { lat: s.cityLat, lng: s.cityLng });
      return d <= 1500 ? [{ s, d }] : [];
    }
    return [];
  });
  const nearest = placed.sort((a, b) => a.d - b.d)[0];
  if (nearest && nearest.d <= 1800) {
    // Everyone who played that venue that night: the headliner is the night.
    const same = shows.filter((s) => s.venue && nearest.s.venue && sameVenue(s.venue, nearest.s.venue));
    return concert(headliner(same.length ? same : [nearest.s]), nearest.d <= 1200);
  }

  // A big night out and only one show in town, at a venue no map knows (a
  // stadium built for one tour): probably that one, offered.
  const unplaced = shows.filter((s) => s.lat == null);
  if (isBigDay(m) && shows.length === 1 && unplaced.length === 1 && !m.near.length) return concert(shows[0], false);

  if (m.near.length) return isBigDay(m) || m.near[0].kind === "s" ? { kind: "name", place: m.near[0].name, venueKind: m.near[0].kind } : null;
  return isBigDay(m) ? { kind: "name", place: null, venueKind: null } : null;
}
