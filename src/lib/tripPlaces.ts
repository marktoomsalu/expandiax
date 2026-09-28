// Places, stays and journeys inside a country: the logic behind the
// country page's "Places in this country" and "All stays & trips", and the
// trip page's journey — kept pure so it's easy to test.

import type { CountryCity, CountryVisit } from "@/lib/types";

type Visit = Pick<CountryVisit, "id" | "year" | "visited_from" | "visited_to" | "date_precision" | "title" | "kind">;
type City = Pick<CountryCity, "id" | "country_visit_id" | "city_name" | "arrived" | "departed" | "position" | "lat" | "lng">;
type Media = { id: string; country_visit_id: string; city_id: string | null; media_type: "image" | "video"; public_url?: string };

const DAY = 86_400_000;
const norm = (s: string) => s.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Straight-line distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "54 km", "1,240 km" — rounded like a road sign. */
export function formatKm(km: number): string {
  const n = km < 10 ? Math.round(km * 10) / 10 : Math.round(km / (km < 100 ? 1 : 5)) * (km < 100 ? 1 : 5);
  return `${n.toLocaleString("en-GB")} km`;
}

/** Whole days between two yyyy-mm-dd dates, counting both ends. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}

/** "1 day", "3 days", "1 week", "2 weeks", "9 months", "2 years" — only for exact dates. */
export function stayLength(v: Pick<Visit, "visited_from" | "visited_to" | "date_precision">): string | null {
  if (v.date_precision !== "day" || !v.visited_from) return null;
  const days = daysBetween(v.visited_from, v.visited_to ?? v.visited_from);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 28) {
    const w = Math.round(days / 7);
    return `${w} ${w === 1 ? "week" : "weeks"}`;
  }
  if (days < 365) {
    const m = Math.max(1, Math.round(days / 30.4));
    return `${m} ${m === 1 ? "month" : "months"}`;
  }
  const y = Math.round(days / 365);
  return `${y} ${y === 1 ? "year" : "years"}`;
}

/** A trip's stops in journey order: by arrival date when known, otherwise as arranged. */
export function orderStops<T extends Pick<City, "arrived" | "position" | "city_name">>(cities: T[]): T[] {
  return [...cities].sort((a, b) => {
    if (a.arrived && b.arrived && a.arrived !== b.arrived) return a.arrived.localeCompare(b.arrived);
    if (a.position !== b.position) return a.position - b.position;
    return a.city_name.localeCompare(b.city_name);
  });
}

export type Leg = { from: string; to: string; km: number | null };

/** The hops between consecutive stops, with distance when both are on the map. */
export function journeyLegs(stops: City[]): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const km = a.lat != null && a.lng != null && b.lat != null && b.lng != null ? distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) : null;
    legs.push({ from: a.id, to: b.id, km });
  }
  return legs;
}

/**
 * Which of a trip's photos belong to each of its places: the ones marked
 * with that place — and, when the trip has just one place, every photo.
 */
export function mediaByPlace<M extends Media>(stops: City[], media: M[]): Map<string, M[]> {
  const out = new Map<string, M[]>(stops.map((s) => [s.id, []]));
  for (const m of media) {
    if (m.city_id && out.has(m.city_id)) out.get(m.city_id)!.push(m);
    else if (!m.city_id && stops.length === 1) out.get(stops[0].id)!.push(m);
  }
  return out;
}

/**
 * A name from a trip's places, for when it has none of its own: "Bled",
 * "Bled & Piran", "Ljubljana, Bled & Piran", "Around Slovenia" (4+), or
 * "Lived in Ljubljana". Empty when there are no places to go on.
 */
export function suggestTripName(kind: Visit["kind"], places: string[], country: string): string {
  const names = places.map((p) => p.trim()).filter(Boolean);
  if (!names.length) return "";
  if (kind === "lived") return `Lived in ${names[0]}`;
  if (names.length === 1) return names[0];
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
  return `Around ${country}`;
}

/** "Slovenia Road Trip" if named; else from its places; else "Trip to Slovenia" / "Lived in Slovenia". */
export function tripName(v: Pick<Visit, "title" | "kind">, country: string, places: string[] = []): string {
  if (v.title.trim()) return v.title.trim();
  return suggestTripName(v.kind, places, country) || (v.kind === "lived" ? `Lived in ${country}` : `Trip to ${country}`);
}

export type CountryPlace = {
  key: string;
  name: string;
  trips: number;
  photos: number;
  videos: number;
  lived: boolean;
  from: string | null; // earliest date known there
  to: string | null;
  lat: number | null;
  lng: number | null;
  cover: string | null;
  cityIds: string[];
};

/** A country's places across all its trips — one card per place, busiest first. */
export function placesInCountry(visits: Visit[], cities: City[], media: Media[]): CountryPlace[] {
  const byVisit = new Map(visits.map((v) => [v.id, v]));
  const places = new Map<string, CountryPlace & { tripIds: Set<string> }>();
  for (const v of visits) {
    const stops = cities.filter((c) => c.country_visit_id === v.id);
    const perPlace = mediaByPlace(stops, media.filter((m) => m.country_visit_id === v.id));
    for (const c of stops) {
      const key = norm(c.city_name);
      if (!key) continue;
      const p =
        places.get(key) ??
        { key, name: c.city_name.trim(), trips: 0, photos: 0, videos: 0, lived: false, from: null, to: null, lat: null, lng: null, cover: null, cityIds: [], tripIds: new Set<string>() };
      p.tripIds.add(v.id);
      p.cityIds.push(c.id);
      const own = perPlace.get(c.id) ?? [];
      p.photos += own.filter((m) => m.media_type === "image").length;
      p.videos += own.filter((m) => m.media_type === "video").length;
      p.cover ??= own.find((m) => m.media_type === "image" && m.public_url)?.public_url ?? null;
      if (byVisit.get(v.id)?.kind === "lived") p.lived = true;
      const start = c.arrived ?? v.visited_from;
      const end = c.departed ?? c.arrived ?? v.visited_to ?? v.visited_from;
      if (start && (!p.from || start < p.from)) p.from = start;
      if (end && (!p.to || end > p.to)) p.to = end;
      if (p.lat == null && c.lat != null && c.lng != null) {
        p.lat = c.lat;
        p.lng = c.lng;
      }
      places.set(key, p);
    }
  }
  return [...places.values()]
    .map(({ tripIds, ...p }) => ({ ...p, trips: tripIds.size }))
    .sort((a, b) => Number(b.lived) - Number(a.lived) || b.trips - a.trips || b.photos + b.videos - (a.photos + a.videos) || a.name.localeCompare(b.name));
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7 Sep", "7 – 8 Sep", "30 Aug – 2 Sep" — for a place's own dates within a trip. */
export function shortDays(from: string | null, to: string | null): string | null {
  if (!from) return null;
  const end = to ?? from;
  const [, am, ad] = from.split("-").map(Number);
  const [, bm, bd] = end.split("-").map(Number);
  if (from === end) return `${ad} ${SHORT_MONTHS[am - 1]}`;
  if (am === bm) return `${ad} – ${bd} ${SHORT_MONTHS[am - 1]}`;
  return `${ad} ${SHORT_MONTHS[am - 1]} – ${bd} ${SHORT_MONTHS[bm - 1]}`;
}

/** "Day 1 – 2" of a trip, for a place with dates inside a trip with a start date. */
export function dayLabel(tripStart: string | null, from: string | null, to: string | null): string | null {
  if (!tripStart || !from) return null;
  const a = daysBetween(tripStart, from);
  const b = daysBetween(tripStart, to ?? from);
  if (a < 1) return null;
  return a === b ? `Day ${a}` : `Day ${a} – ${b}`;
}

/**
 * A stay's dates for the country timeline: "2019", "Sep 2025", "8 Aug 2025",
 * "8 – 10 Aug 2025", "30 Aug – 2 Sep 2025" — and months only for long stays,
 * "Sep 2025 – Jun 2026".
 */
export function stayWhen(v: Pick<Visit, "year" | "visited_from" | "visited_to" | "date_precision">): string {
  if (v.date_precision === "year" || !v.visited_from) return String(v.year);
  const [ay, am, ad] = v.visited_from.split("-").map(Number);
  if (v.date_precision === "month") return `${SHORT_MONTHS[am - 1]} ${ay}`;
  const to = v.visited_to ?? v.visited_from;
  const [by, bm, bd] = to.split("-").map(Number);
  if (daysBetween(v.visited_from, to) > 60) {
    return ay === by ? `${SHORT_MONTHS[am - 1]} – ${SHORT_MONTHS[bm - 1]} ${ay}` : `${SHORT_MONTHS[am - 1]} ${ay} – ${SHORT_MONTHS[bm - 1]} ${by}`;
  }
  if (ay !== by) return `${ad} ${SHORT_MONTHS[am - 1]} ${ay} – ${bd} ${SHORT_MONTHS[bm - 1]} ${by}`;
  return `${shortDays(v.visited_from, to)} ${ay}`;
}

/** The month a stay starts, for the timeline rail — "AUG", or null when only the year is known. */
export function stayMonth(v: Pick<Visit, "visited_from" | "date_precision">): string | null {
  if (v.date_precision === "year" || !v.visited_from) return null;
  return SHORT_MONTHS[Number(v.visited_from.slice(5, 7)) - 1];
}

/** "5 trips · 3 places · Lived here 2025 – 2026" — the line under a country's name. */
export function countrySummary(visits: Pick<Visit, "year" | "visited_from" | "visited_to" | "kind">[], places: number, memories: number): string {
  const trips = visits.filter((v) => v.kind !== "lived").length;
  const lived = visits.filter((v) => v.kind === "lived");
  const parts: string[] = [];
  if (trips || !lived.length) parts.push(`${trips} ${trips === 1 ? "trip" : "trips"}`);
  if (places) parts.push(`${places} ${places === 1 ? "place" : "places"}`);
  else parts.push(memories ? `${memories} ${memories === 1 ? "memory" : "memories"}` : "no photos yet");
  if (lived.length) {
    const years = lived.flatMap((v) => [v.visited_from ? Number(v.visited_from.slice(0, 4)) : v.year, v.visited_to ? Number(v.visited_to.slice(0, 4)) : v.year]);
    const a = Math.min(...years);
    const b = Math.max(...years);
    parts.push(a === b ? `Lived here ${a}` : `Lived here ${a} – ${b}`);
  }
  return parts.join(" · ");
}
