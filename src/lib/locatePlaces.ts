import type { createClient } from "@/lib/supabase/server";
import { locateName } from "@/lib/places";

// Some ways of adding a place (from a photo, while signing up, by just
// typing a name) save the name without coordinates, and a place without
// them can't go on a map. This finds them: first from the same place on
// another trip, then by looking the name up within the country. What's
// found is saved (when the viewer may change the place), so it's only
// ever looked up once.

type Supabase = ReturnType<typeof createClient>;
type Spot = { lat: number; lng: number };
type PlaceRow = { id: string; city_name: string; lat: number | null; lng: number | null };

const key = (name: string) => name.trim().toLowerCase();

export async function locatePlaces<T extends PlaceRow>(supabase: Supabase, places: T[], countryCode: string): Promise<T[]> {
  if (places.every((p) => p.lat != null && p.lng != null)) return places;

  const known = new Map<string, Spot>();
  for (const p of places) if (p.lat != null && p.lng != null && !known.has(key(p.city_name))) known.set(key(p.city_name), { lat: p.lat, lng: p.lng });

  const unknown = [...new Set(places.filter((p) => (p.lat == null || p.lng == null) && !known.has(key(p.city_name))).map((p) => p.city_name.trim()))].slice(0, 12);
  await Promise.all(
    unknown.map(async (name) => {
      const spot = await locateName(name, countryCode).catch(() => null);
      if (spot) known.set(key(name), spot);
    })
  );

  const found = places.flatMap((p) => (p.lat == null || p.lng == null) && known.has(key(p.city_name)) ? [{ id: p.id, ...known.get(key(p.city_name))! }] : []);
  if (found.length) await Promise.all(found.map((f) => supabase.from("country_cities").update({ lat: f.lat, lng: f.lng }).eq("id", f.id)));
  const byId = new Map(found.map((f) => [f.id, f]));
  return places.map((p) => (byId.has(p.id) ? { ...p, lat: byId.get(p.id)!.lat, lng: byId.get(p.id)!.lng } : p));
}
