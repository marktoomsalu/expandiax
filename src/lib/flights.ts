import { unstable_cache } from "next/cache";
import { distanceKm } from "@/lib/tripPlaces";
import type { NearbyWhere } from "@/lib/concerts";
import data from "@/data/flightCities.json";

// "Flights from €105": the cheapest return flight Aviasales has seen lately
// between the nearest airport city to you and a country's main one, from
// Travelpayouts' price data (TRAVELPAYOUTS_TOKEN), linking to that search on
// Aviasales with our partner marker (TRAVELPAYOUTS_MARKER). Only two city
// codes are ever sent — never who's asking, never where exactly they are.

const { gateways, cities } = data as unknown as { gateways: Record<string, string>; cities: [string, number, number][] };
const TWELVE_HOURS = 60 * 60 * 12;

export type Flight = { price: number; currency: string; depart: string; back: string | null; url: string };

export function flightsConfigured(env = process.env): boolean {
  return !!env.TRAVELPAYOUTS_TOKEN?.trim() && !!env.TRAVELPAYOUTS_MARKER?.trim();
}

/** The city code to fly to for a country — its capital's, or its main hub. */
export const gatewayFor = (countryCode: string): string | null => gateways[countryCode.toUpperCase()] ?? null;

/** The airport city to fly from: the nearest one to where someone is (within 250 km), else their country's. */
export function originFor(where: NearbyWhere | null, homeCountry: string | null): string | null {
  if (where && "lat" in where) {
    let best: string | null = null;
    let bestKm = 250;
    for (const [code, lat, lng] of cities) {
      if (Math.abs(lat - where.lat) > 3) continue;
      const km = distanceKm({ lat, lng }, where);
      if (km < bestKm) {
        best = code;
        bestKm = km;
      }
    }
    if (best) return best;
    if (where.countryCode) return gatewayFor(where.countryCode);
  }
  if (where && "countryCode" in where && where.countryCode) return gatewayFor(where.countryCode);
  return homeCountry ? gatewayFor(homeCountry) : null;
}

type CheapRow = { price?: number; departure_at?: string; return_at?: string };

/** The cheapest round trip in a Travelpayouts "cheap" answer. */
export function cheapest(body: { data?: Record<string, Record<string, CheapRow>>; currency?: string } | null): { price: number; currency: string; depart: string; back: string | null } | null {
  let best: { price: number; depart: string; back: string | null } | null = null;
  for (const byStops of Object.values(body?.data ?? {})) {
    for (const r of Object.values(byStops ?? {})) {
      if (typeof r.price !== "number" || r.price <= 0 || !r.departure_at) continue;
      if (!best || r.price < best.price) best = { price: r.price, depart: r.departure_at.slice(0, 10), back: r.return_at?.slice(0, 10) ?? null };
    }
  }
  return best ? { ...best, currency: (body?.currency ?? "eur").toUpperCase() } : null;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;

/** Aviasales' search for exactly that trip (one adult), credited to our marker. */
export function aviasalesUrl(origin: string, dest: string, depart: string, back: string | null, marker: string): string {
  const path = `${origin}${ddmm(depart)}${dest}${back ? ddmm(back) : ""}1`;
  return `https://www.aviasales.com/search/${path}?marker=${encodeURIComponent(marker)}`;
}

async function cheapFromApi(origin: string, dest: string) {
  const qs = new URLSearchParams({ origin, destination: dest, currency: "eur", token: process.env.TRAVELPAYOUTS_TOKEN!.trim() });
  const res = await fetch(`https://api.travelpayouts.com/v1/prices/cheap?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  const body = await res.json();
  if (body?.success === false) throw new Error("no prices");
  return cheapest(body);
}

/** The cheapest return flight from `origin` to a country, or null (no data, not set up, or the service is down). */
export async function flightTo(origin: string | null, countryCode: string): Promise<Flight | null> {
  const dest = gatewayFor(countryCode);
  if (!flightsConfigured() || !origin || !dest || origin === dest) return null;
  try {
    // A good answer is kept for 12 hours and shared by everyone flying the same route; failures never are.
    const found = await unstable_cache(() => cheapFromApi(origin, dest), ["flight-cheap", origin, dest], { revalidate: TWELVE_HOURS })();
    if (!found) return null;
    return { ...found, url: aviasalesUrl(origin, dest, found.depart, found.back, process.env.TRAVELPAYOUTS_MARKER!.trim()) };
  } catch {
    return null;
  }
}
