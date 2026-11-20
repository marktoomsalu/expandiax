// Server side of "Find my world" events: what played, for a moment the phone
// describes by day, town names, venue names and a rough area. See eventMatch.ts.

import { showsAtVenue, showsInCountryOnDay, showsOnDay, type ShowThatNight } from "./concerts";
import { metres, sameVenue, type MomentAsk, type ShowFound } from "./eventMatch";

export type Geocode = (venue: string, city: string, countryCode: string) => Promise<{ lat: number; lng: number } | null>;

const plain = (s: ShowThatNight) => ({ artist: s.artist, venue: s.venue, city: s.city, cityLat: s.cityLat ?? null, cityLng: s.cityLng ?? null, songs: s.songs ?? 0 });
const near = (s: ShowThatNight, area: { lat: number; lng: number }, km: number) =>
  s.cityLat != null && s.cityLng != null && metres(area, { lat: s.cityLat, lng: s.cityLng }) <= km * 1000;

export async function showsFor(a: MomentAsk, geocode: Geocode): Promise<ShowFound[]> {
  // At the venue itself, by any of its names: the surest answer.
  for (const name of a.venues.slice(0, 4)) {
    const found = await showsAtVenue(name, a.day).catch(() => []);
    if (found.length) return found.slice(0, 8).map((s) => ({ ...plain(s), lat: null, lng: null, atVenue: true }));
  }

  // Otherwise what played in its towns that day.
  const seen = new Set<string>();
  const shows: ShowThatNight[] = [];
  const add = (list: ShowThatNight[]) => {
    for (const s of list) {
      const key = `${s.artist}|${s.venue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      shows.push(s);
    }
  };
  for (const town of a.towns.slice(0, 3)) add(await showsOnDay(town, a.day, a.countryCode, 1).catch(() => []));

  // None of the towns' shows was at the venue it was at (or nothing was
  // listed under its towns): it may be listed under a town the phone doesn't
  // know ("Fornebu" for Oslo's arena). Everything in the country that day,
  // kept if its town is in the area.
  const atAVenue = a.venues.length > 0 && shows.some((s) => s.venue && a.venues.some((v) => sameVenue(s.venue!, v)));
  if (a.area && a.countryCode && !atAVenue && (a.venues.length > 0 || shows.length === 0)) {
    add((await showsInCountryOnDay(a.countryCode, a.day, 3).catch(() => [])).filter((s) => near(s, a.area!, 30)));
  }

  // Each venue on the map once (several acts share one), so the phone can
  // tell whether its photos were there. Only a few per moment: the area's
  // country-wide finds and the biggest nights (longest setlists) first.
  const list = shows.slice(0, 16);
  const order = [...list].sort((x, y) => Number(near(y, a.area ?? { lat: 999, lng: 999 }, 30)) - Number(near(x, a.area ?? { lat: 999, lng: 999 }, 30)) || (y.songs ?? 0) - (x.songs ?? 0));
  const places = new Map<string, Promise<{ lat: number; lng: number } | null>>();
  for (const s of order) {
    const key = `${s.venue}|${s.city}`;
    if (!s.venue || places.has(key)) continue;
    if (places.size >= 4) break;
    places.set(key, geocode(s.venue, s.city ?? "", s.countryCode ?? a.countryCode ?? "").catch(() => null));
  }
  return Promise.all(
    list.map(async (s) => {
      const at = s.venue ? ((await places.get(`${s.venue}|${s.city}`)) ?? null) : null;
      return { ...plain(s), lat: at?.lat ?? null, lng: at?.lng ?? null, atVenue: false };
    })
  );
}

// Kinds of places that are a town or an area, not a venue: a match on them says nothing.
const AREA = new Set(["boundary", "place"]);

// OpenStreetMap's search allows one question a second: they wait in line.
let line: Promise<unknown> = Promise.resolve();
function inLine<T>(work: () => Promise<T>): Promise<T> {
  const run = line.then(work, work);
  line = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100))
  );
  return run;
}

/** Where a listed venue is, from OpenStreetMap (Nominatim): never a town or an area. */
export const osmGeocode: Geocode = (venue, city, countryCode) =>
  inLine(async () => {
    const qs = new URLSearchParams({ format: "jsonv2", limit: "3", q: [venue, city].filter(Boolean).join(", ") });
    if (/^[A-Z]{2}$/.test(countryCode)) qs.set("countrycodes", countryCode.toLowerCase());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { "User-Agent": "ExpandiaX/1.0 (https://expandiax.com)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`nominatim_${res.status}`);
    const hits = (await res.json()) as { lat: string; lon: string; category?: string }[];
    const hit = hits.find((h) => !AREA.has(h.category ?? ""));
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  });
