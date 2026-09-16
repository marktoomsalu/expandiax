export type PlaceSuggestion = { venue: string | null; city: string | null; countryCode: string | null };

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  country_code?: string;
};
type NominatimResult = { display_name: string; address?: NominatimAddress };

// Free, no-key place lookup (OpenStreetMap/Nominatim) — resolves a typed
// event title to a real, named place when one actually matches, rather than
// guessing. No date capability at all (geocoding has no concept of time or
// events) — that's the deliberate tradeoff for not needing a paid LLM API.
export async function lookupPlace(query: string): Promise<PlaceSuggestion> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`,
    {
      // Nominatim's usage policy requires an identifying User-Agent.
      headers: { "User-Agent": "ExpandiaX/1.0 (https://expandiax.com)" },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error("lookup_failed");
  const results = (await res.json()) as NominatimResult[];
  const first = results[0];
  if (!first) return { venue: null, city: null, countryCode: null };

  const venue = first.display_name.split(",")[0]?.trim() || null;
  const a = first.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
  const countryCode = a.country_code ? a.country_code.toUpperCase() : null;
  return { venue, city, countryCode };
}
