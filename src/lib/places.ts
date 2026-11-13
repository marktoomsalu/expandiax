// City search for "Happening near …", via Open-Meteo's free geocoding API.
// Only the typed text is sent — nothing about the person searching.

export type Place = { id: number; name: string; region: string | null; countryCode: string | null; lat: number; lng: number };

type OpenMeteoPlace = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
  feature_code?: string;
  population?: number;
};

// Populated-place kinds that aren't a city or town you'd go to: a section
// of a city ("Tallinna Eeslinn"), and historical, abandoned or destroyed places.
const NOT_A_TOWN = new Set(["PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"]);

export function placeFromOpenMeteo(r: OpenMeteoPlace): Place | null {
  // Populated places only (cities, towns), not rivers, airports or regions.
  if (!r.feature_code?.startsWith("PPL") || NOT_A_TOWN.has(r.feature_code)) return null;
  if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null;
  return {
    id: r.id,
    name: r.name,
    region: r.admin1 ?? null,
    countryCode: r.country_code?.toUpperCase() ?? null,
    lat: r.latitude,
    lng: r.longitude,
  };
}

export async function searchPlaces(query: string, limit = 6): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ name: q, count: "10", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: OpenMeteoPlace[] };
  // Bigger places first (Bologna before a village called Bolog), each place once.
  const seen = new Set<string>();
  return (data.results ?? [])
    .filter((r) => placeFromOpenMeteo(r))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .map((r) => placeFromOpenMeteo(r)!)
    .filter((p) => {
      const key = `${p.name}|${p.region}|${p.countryCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * Where a named place in a country is, for putting it on a map: the biggest
 * town of that name there, or else any spot of that name (a region, a
 * national park, the Cliffs of Moher).
 */
export async function locateName(name: string, countryCode: string): Promise<{ lat: number; lng: number } | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  const params = new URLSearchParams({ name: q, count: "10", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: OpenMeteoPlace[] };
  const here = (data.results ?? [])
    .filter((r) => r.country_code?.toUpperCase() === countryCode.toUpperCase() && Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const best = here.find((r) => placeFromOpenMeteo(r)) ?? here[0];
  return best ? { lat: best.latitude, lng: best.longitude } : null;
}
