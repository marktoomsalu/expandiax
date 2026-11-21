// "Find my world", the clever part that runs on the phone after the scan:
// each trip's towns (from the town list, on the device), and which photo
// moments were concerts, matches and festivals (venues on the device, then
// only a day, a town and venue names asked of the server).

import { loadTowns, townFor, groupByTown, type Town } from "./photoPlaces";
import { decideAll, isBigDay, venuesFromRows, venuesNear, type KnownEvent, type Moment, type MomentAsk, type ShowFound, type Venue, type VenueKind } from "./eventMatch";
import { distanceKm } from "./tripPlaces";
import type { FoundTrip } from "./tripFinder";
import type { ScanMoment } from "./photoScan";
import type { EventType } from "./types";

export type TripTown = { name: string; lat: number; lng: number; arrived: string | null; departed: string | null; photos: number };

/** The towns of a trip, the ones with most photos first (for its name), each with its days. */
export async function townsOf(trip: Pick<FoundTrip, "code" | "spots">): Promise<TripTown[]> {
  const towns = await loadTowns(trip.code);
  if (!towns.length) return [];
  const spots = trip.spots.map((s) => ({ day: s.d, town: townFor({ lat: s.la, lng: s.ln }, towns), n: s.n }));
  const groups = groupByTown(spots);
  return groups
    .map((g) => ({ name: g.name, lat: g.lat, lng: g.lng, arrived: g.arrived, departed: g.departed, photos: g.photos.reduce((sum, i) => sum + spots[i].n, 0) }))
    .sort((a, b) => b.photos - a.photos)
    .slice(0, 10);
}

export async function nameTrips(trips: FoundTrip[]): Promise<Record<string, TripTown[]>> {
  const out: Record<string, TripTown[]> = {};
  await Promise.all(
    trips.map(async (t) => {
      out[t.id] = await townsOf(t).catch(() => []);
    })
  );
  return out;
}

export type FoundEvent = {
  id: string;
  type: EventType;
  title: string;
  artist: string | null;
  venue: string | null;
  city: string | null;
  code: string;
  /** yyyy-mm-dd */
  date: string;
  sure: boolean;
  photos: number;
  covers: string[];
};

/** A big day nothing was listed for: the person says what it was. */
export type BigDay = {
  id: string;
  date: string;
  code: string;
  /** The venue it was at, or the town. */
  place: string | null;
  city: string | null;
  venueKind: VenueKind | null;
  photos: number;
  hours: number;
  covers: string[];
};

const venueCache = new Map<string, Promise<Venue[]>>();
function loadVenues(code: string): Promise<Venue[]> {
  let p = venueCache.get(code);
  if (!p) {
    p = fetch(`/data/venues/${code}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<[string, number, number, string, string[]?][]>) : []))
      .then(venuesFromRows)
      .catch(() => {
        venueCache.delete(code);
        return [];
      });
    venueCache.set(code, p);
  }
  return p;
}

const hourOf = (stamp: string) => Number(stamp.slice(11, 13));
const hoursBetween = (a: string, b: string) => (Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 3_600_000;

/** Whether a moment looks like going out to something: an evening, or a long busy day. */
export function eventLike(m: ScanMoment): boolean {
  const hours = hoursBetween(m.s, m.e);
  const end = hourOf(m.e);
  const enough = m.n >= 8 || (m.v >= 2 && m.n >= 4);
  const evening = end >= 18 || end < 4;
  return enough && (evening || isBigDay({ photos: m.n, hours }));
}

/** The town names a moment could be listed under: the town it's in, the nearest, and the big city nearby. */
export function townNames(spot: { lat: number; lng: number }, towns: Town[]): string[] {
  const named = townFor(spot, towns)?.name;
  const near = towns
    .map((t) => ({ t, d: distanceKm(spot, t) }))
    .filter((x) => x.d <= 35)
    .sort((a, b) => a.d - b.d);
  const nearest = near[0]?.t.name;
  const biggest = [...near].sort((a, b) => b.t.pop - a.t.pop)[0]?.t.name;
  return [...new Set([named, biggest, nearest].filter((x): x is string => !!x))];
}

/** The question for one moment: day, town and venue names, and a rough area (~20 km). No exact place. */
export function askFor(id: string, m: ScanMoment, code: string, near: Venue[], towns: Town[]): MomentAsk {
  return {
    id,
    day: m.s.slice(0, 10),
    countryCode: code,
    towns: townNames({ lat: m.la, lng: m.ln }, towns),
    venues: [...new Set(near.slice(0, 3).flatMap((v) => [v.name, ...v.aka.slice(0, 2)]))].slice(0, 6),
    area: { lat: Math.round(m.la * 5) / 5, lng: Math.round(m.ln * 5) / 5 },
  };
}

/**
 * Which moments were events, and which big days are worth naming. Venues
 * are found on the phone; the server only hears days, town and venue names
 * and rough areas, and the phone decides from its answer.
 */
export async function findEvents(moments: ScanMoment[], locate: (lat: number, lng: number) => string | null): Promise<{ events: FoundEvent[]; bigDays: BigDay[] }> {
  // Evenings and big days; and any few hours of photos at a stadium (an afternoon match).
  const candidates: ScanMoment[] = [];
  for (const m of [...moments].sort((a, b) => b.n - a.n)) {
    if (candidates.length >= 60) break;
    if (eventLike(m)) candidates.push(m);
    else if (m.n >= 8) {
      const code = locate(m.la, m.ln);
      if (code && venuesNear({ lat: m.la, lng: m.ln }, await loadVenues(code)).some((v) => v.kind === "s")) candidates.push(m);
    }
  }
  type Asked = { ask: MomentAsk; moment: Moment; scan: ScanMoment; code: string; city: string | null };
  const asked: Asked[] = [];
  for (const m of candidates) {
    if (asked.length >= 30) break;
    const code = locate(m.la, m.ln);
    if (!code) continue;
    const [venues, towns] = await Promise.all([loadVenues(code), loadTowns(code)]);
    const near = venuesNear({ lat: m.la, lng: m.ln }, venues).slice(0, 3);
    const hours = hoursBetween(m.s, m.e);
    const moment: Moment = { id: `${m.s}|${m.la.toFixed(3)}`, lat: m.la, lng: m.ln, day: m.s.slice(0, 10), photos: m.n, hours, near };
    if (!near.length && !isBigDay(moment)) continue;
    asked.push({ ask: askFor(moment.id, m, code, near, towns), moment, scan: m, code, city: townFor({ lat: m.la, lng: m.ln }, towns)?.name ?? null });
  }
  if (!asked.length) return { events: [], bigDays: [] };

  const res = await fetch("/api/scan/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moments: asked.map((a) => a.ask) }),
  });
  const answers = res.ok ? ((await res.json()) as { answers: { id: string; shows: ShowFound[]; known?: KnownEvent[] }[] }).answers : [];
  const byId = new Map(answers.map((a) => [a.id, a]));

  const events: FoundEvent[] = [];
  const bigDays: BigDay[] = [];
  for (const a of asked) {
    const answer = byId.get(a.moment.id);
    const d = decideAll(a.moment, answer?.shows ?? [], answer?.known ?? [], a.ask.towns, a.moment.day.slice(0, 4));
    if (!d) continue;
    if (d.kind === "event") {
      // The same night at the same place (photos before and after a break) is one event.
      const twin = events.find((f) => f.date === a.moment.day && f.title === d.title);
      if (twin) {
        twin.photos += a.scan.n;
        twin.sure ||= d.sure;
        continue;
      }
      events.push({ id: a.moment.id, type: d.type, title: d.title, artist: d.artist, venue: d.venue, city: a.city, code: a.code, date: a.moment.day, sure: d.sure, photos: a.scan.n, covers: a.scan.a });
    } else {
      if (bigDays.some((b) => b.date === a.moment.day && b.place === d.place)) continue;
      bigDays.push({ id: a.moment.id, date: a.moment.day, code: a.code, place: d.place, city: a.city, venueKind: d.venueKind, photos: a.scan.n, hours: a.moment.hours, covers: a.scan.a });
    }
  }
  // A big day on the same day as a found event is that event.
  const named = bigDays.filter((b) => !events.some((e) => e.date === b.date));
  return {
    events: events.sort((x, y) => y.date.localeCompare(x.date)),
    bigDays: named.sort((x, y) => y.photos - x.photos).slice(0, 6).sort((x, y) => y.date.localeCompare(x.date)),
  };
}
