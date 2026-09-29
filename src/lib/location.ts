import { headers } from "next/headers";
import { countryByCode } from "@/lib/countries";
import type { NearbyWhere } from "@/lib/concerts";

export type Here = {
  where: NearbyWhere; // for event search
  place: string; // "Bologna", or a country name when that's all we know
  city: string | null;
  countryCode: string | null;
  source: "picked" | "connection" | "home";
};

type Picked = { city?: string; cc?: string; lat?: string; lng?: string };

/**
 * Where someone is, for "near you": a city they picked on this page (from
 * the URL — never saved), else the approximate city Vercel works out from
 * the connection (no location permission, and it follows you when you
 * travel), else the home country on their profile.
 */
export function whereAmI(homeCountry: string | null, picked?: Picked): Here | null {
  const pLat = Number(picked?.lat);
  const pLng = Number(picked?.lng);
  if (picked?.city && Number.isFinite(pLat) && Number.isFinite(pLng) && Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180) {
    const cc = countryByCode(picked.cc)?.code ?? null;
    const town = picked.city.slice(0, 80);
    return { where: { lat: pLat, lng: pLng, city: town, countryCode: cc }, place: town, city: town, countryCode: cc, source: "picked" };
  }

  const h = headers();
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lng = Number(h.get("x-vercel-ip-longitude"));
  let city = "";
  try {
    city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "").trim();
  } catch {}
  if (h.get("x-vercel-ip-latitude") && Number.isFinite(lat) && Number.isFinite(lng)) {
    const country = countryByCode(h.get("x-vercel-ip-country"));
    return { where: { lat, lng, city: city || null, countryCode: country?.code ?? null }, place: city || country?.name || "you", city: city || null, countryCode: country?.code ?? null, source: "connection" };
  }

  const home = countryByCode(homeCountry);
  return home ? { where: { countryCode: home.code }, place: home.name, city: null, countryCode: home.code, source: "home" } : null;
}
