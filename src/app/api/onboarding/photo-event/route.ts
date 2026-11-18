import { NextRequest, NextResponse } from "next/server";
import { showsOnDay, type ShowThatNight } from "@/lib/concerts";
import { countryByCode } from "@/lib/countries";

export const dynamic = "force-dynamic";

type Reverse = { address?: { country_code?: string; city?: string; town?: string; village?: string; suburb?: string; city_district?: string; municipality?: string; county?: string } };

/**
 * For the first steps (before there's an account): where a photo was taken
 * (its country and city, from OpenStreetMap) and, from its day, the concerts
 * that played there that night (setlist.fm). Only the photo's place and day
 * are sent, never the photo.
 */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const day = request.nextUrl.searchParams.get("date") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "No place in this photo." }, { status: 400 });
  }
  // Rounded (about 1 km): enough for the city, and the same answer is shared between nearby photos.
  const r = (n: number) => Math.round(n * 100) / 100;
  let countryCode: string | null = null;
  let city: string | null = null;
  // The part of town it was taken in ("Wembley"): venues there come first.
  let near: string[] = [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${r(lat)}&lon=${r(lng)}`, {
      headers: { "User-Agent": "ExpandiaX/1.0 (https://expandiax.com)", "Accept-Language": "en" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    const a = ((await res.json()) as Reverse).address;
    countryCode = countryByCode(a?.country_code?.toUpperCase())?.code ?? null;
    // As people (and setlist.fm) say it: "Greater London" is London, "City of Westminster" Westminster.
    city = (a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.county ?? null)?.replace(/^(Greater|City of)\s+/i, "") ?? null;
    near = [a?.town, a?.suburb, a?.village, a?.city_district?.replace(/^London Borough of\s+/i, "")]
      .filter((x): x is string => !!x && x !== city)
      .map((x) => x.toLowerCase());
  } catch {
    // Unknown place: the person picks it themselves.
  }
  let events: ShowThatNight[] = [];
  if (city && /^\d{4}-\d{2}-\d{2}$/.test(day) && process.env.SETLISTFM_API_KEY) {
    events = await showsOnDay(city, day, countryCode).catch(() => []);
    const here = (e: ShowThatNight) => (near.some((n) => (e.venue ?? "").toLowerCase().includes(n)) ? 0 : 1);
    events = events.map((e, i) => ({ e, i })).sort((a, b) => here(a.e) - here(b.e) || a.i - b.i).map((x) => x.e).slice(0, 8);
  }
  return NextResponse.json({ countryCode, city, events });
}
