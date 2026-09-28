import { distanceKm } from "@/lib/tripPlaces";

// Which town each photo was taken in, worked out on the person's own device:
// the photo's location (from its EXIF) against an open list of towns in the
// trip's country (GeoNames, CC BY 4.0, served from /data/places). The
// location itself never leaves the device and is never stored — only the
// town's name, once the person keeps it.

export type Town = { name: string; lat: number; lng: number; pop: number };
type Spot = { lat: number; lng: number };

const MAX_KM = 30;

/**
 * The town a photo was most likely taken in: close by, but a big town a few
 * km away wins over a village right next door (a photo in a city's suburbs
 * is "in the city"). Nothing within 30 km → null.
 */
export function townFor(spot: Spot, towns: Town[]): Town | null {
  let best: Town | null = null;
  let bestScore = Infinity;
  const dLat = MAX_KM / 111;
  for (const t of towns) {
    if (Math.abs(t.lat - spot.lat) > dLat) continue;
    const km = distanceKm(spot, t);
    if (km > MAX_KM) continue;
    const score = km - 3 * Math.log10(Math.max(t.pop, 1000));
    if (score < bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export type SuggestedPlace = {
  key: string; // the town's name, normalised — also how it's matched to a trip's own places
  name: string;
  lat: number;
  lng: number;
  arrived: string | null;
  departed: string | null;
  photos: number[]; // indexes into the photos passed in
};

export const placeKey = (name: string) => name.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Photos grouped by town, in the order they were visited, with the days spent in each. */
export function groupByTown(photos: { day: string | null; town: Town | null }[]): SuggestedPlace[] {
  const out = new Map<string, SuggestedPlace>();
  photos.forEach((p, i) => {
    if (!p.town) return;
    const key = placeKey(p.town.name);
    const s = out.get(key) ?? { key, name: p.town.name, lat: p.town.lat, lng: p.town.lng, arrived: null, departed: null, photos: [] };
    s.photos.push(i);
    if (p.day) {
      if (!s.arrived || p.day < s.arrived) s.arrived = p.day;
      if (!s.departed || p.day > s.departed) s.departed = p.day;
    }
    out.set(key, s);
  });
  // A photo or two taken just outside a place you spent time in (a gorge
  // near Bled, a viewpoint above a town) belongs to that place, not a new one.
  const all = [...out.values()];
  for (const small of all.filter((s) => s.photos.length <= 2)) {
    const home = all
      .filter((s) => s !== small && out.has(s.key) && s.photos.length > small.photos.length && distanceKm(s, small) <= 10)
      .sort((a, b) => distanceKm(a, small) - distanceKm(b, small))[0];
    if (!home) continue;
    home.photos.push(...small.photos);
    home.photos.sort((a, b) => a - b);
    if (small.arrived && (!home.arrived || small.arrived < home.arrived)) home.arrived = small.arrived;
    if (small.departed && (!home.departed || small.departed > home.departed)) home.departed = small.departed;
    out.delete(small.key);
  }
  return [...out.values()].sort((a, b) => {
    if (a.arrived && b.arrived && a.arrived !== b.arrived) return a.arrived.localeCompare(b.arrived);
    if (!a.arrived !== !b.arrived) return a.arrived ? -1 : 1;
    return a.photos[0] - b.photos[0];
  });
}

const cache = new Map<string, Promise<Town[]>>();

/** A country's towns, fetched once per country. Empty if there's no list for it. */
export function loadTowns(countryCode: string): Promise<Town[]> {
  const cc = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return Promise.resolve([]);
  let p = cache.get(cc);
  if (!p) {
    p = fetch(`/data/places/${cc}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<[string, number, number, number][]>) : []))
      .then((rows) => rows.map(([name, lat, lng, pop]) => ({ name, lat, lng, pop })))
      .catch(() => {
        cache.delete(cc);
        return [];
      });
    cache.set(cc, p);
  }
  return p;
}
