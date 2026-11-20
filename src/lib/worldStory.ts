// "Find my world", the clever part that runs on the phone after the scan:
// each trip's towns (from the town list, on the device), and which photo
// moments were concerts, matches and festivals (venues on the device, then
// only a day, a town and venue names asked of the server).

import { loadTowns, townFor, groupByTown, type Town } from "./photoPlaces";
import { venuesFromRows, venuesNear, type MatchedEvent, type MomentQuery, type Venue } from "./eventMatch";
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
  return enough && (evening || (hours >= 3 && m.n >= 20));
}

/**
 * Which moments were events. Venues are found on the phone; only moments at
 * a venue (or a long festival-like day) are asked about, with their day,
 * town and venue names.
 */
export async function findEvents(moments: ScanMoment[], locate: (lat: number, lng: number) => string | null): Promise<FoundEvent[]> {
  const candidates = moments.filter(eventLike).sort((a, b) => b.n - a.n);
  const asked: { query: MomentQuery; moment: ScanMoment; code: string; city: string | null }[] = [];
  for (const m of candidates) {
    if (asked.length >= 40) break;
    const code = locate(m.la, m.ln);
    if (!code) continue;
    const [venues, towns] = await Promise.all([loadVenues(code), loadTowns(code)]);
    const near = venuesNear({ lat: m.la, lng: m.ln }, venues).slice(0, 5);
    const hours = hoursBetween(m.s, m.e);
    if (!near.length && !(hours >= 3 && m.n >= 20)) continue;
    const town: Town | null = towns.length ? townFor({ lat: m.la, lng: m.ln }, towns) : null;
    const id = `${m.s}|${m.la.toFixed(3)}`;
    asked.push({
      moment: m,
      code,
      city: town?.name ?? null,
      query: { id, day: m.s.slice(0, 10), city: town?.name ?? null, countryCode: code, venues: near.map((v) => ({ name: v.name, kind: v.kind, aka: v.aka })), photos: m.n, hours: Math.round(hours * 10) / 10 },
    });
  }
  if (!asked.length) return [];

  const res = await fetch("/api/scan/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moments: asked.map((a) => a.query) }),
  });
  if (!res.ok) return [];
  const { events } = (await res.json()) as { events: MatchedEvent[] };
  const byId = new Map(asked.map((a) => [a.query.id, a]));

  const found: FoundEvent[] = [];
  for (const e of events) {
    const a = byId.get(e.id);
    if (!a) continue;
    const date = a.moment.s.slice(0, 10);
    // The same night at the same place (photos before and after a break) is one event.
    const twin = found.find((f) => f.date === date && f.venue === e.venue);
    if (twin) {
      twin.photos += a.moment.n;
      twin.sure ||= e.sure;
      continue;
    }
    found.push({ id: e.id, type: e.type, title: e.title, artist: e.artist, venue: e.venue, city: a.city, code: a.code, date, sure: e.sure, photos: a.moment.n, covers: a.moment.a });
  }
  return found.sort((x, y) => y.date.localeCompare(x.date));
}
