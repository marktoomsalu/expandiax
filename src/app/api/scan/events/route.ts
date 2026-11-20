import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import type { MomentAsk, ShowFound } from "@/lib/eventMatch";
import { osmGeocode, showsFor, type Geocode } from "@/lib/eventLookup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MOMENTS = 30;

// A venue's place is kept for a month: venues don't move.
const cachedGeocode: Geocode = (venue, city, countryCode) =>
  unstable_cache(() => osmGeocode(venue, city, countryCode), ["venue-at", venue.toLowerCase(), city.toLowerCase(), countryCode], { revalidate: 60 * 60 * 24 * 30 })();

/**
 * "Find my world" (iPhone app, before or after sign-up): what played on
 * these days at these venues or in these towns, and where each venue is.
 * Each moment comes as a day, a few town and venue names and a rough area
 * (~20 km), worked out on the phone: no exact place, no photos, nothing
 * about the person, and nothing is kept. The phone decides from the answer
 * whether its photos were taken there.
 */
export async function POST(request: NextRequest) {
  let asks: MomentAsk[];
  try {
    const body = (await request.json()) as { moments?: unknown };
    asks = (Array.isArray(body.moments) ? body.moments : []).slice(0, MAX_MOMENTS).flatMap((raw): MomentAsk[] => {
      const x = raw as Partial<MomentAsk>;
      if (typeof x.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.day)) return [];
      const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === "string" && !!s.trim()).slice(0, n).map((s) => s.trim().slice(0, 100));
      const lat = Number(x.area?.lat);
      const lng = Number(x.area?.lng);
      return [
        {
          id: String(x.id ?? "").slice(0, 60),
          day: x.day,
          countryCode: typeof x.countryCode === "string" && /^[A-Z]{2}$/.test(x.countryCode) ? x.countryCode : null,
          towns: list(x.towns, 3),
          venues: list(x.venues, 6),
          // Never finer than ~20 km, whatever is sent.
          area: Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: Math.round(lat * 5) / 5, lng: Math.round(lng * 5) / 5 } : null,
        },
      ];
    });
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!process.env.SETLISTFM_API_KEY) return NextResponse.json({ answers: [] });

  const answers: { id: string; shows: ShowFound[] }[] = [];
  const queue = [...asks];
  async function worker() {
    for (let a = queue.shift(); a; a = queue.shift()) answers.push({ id: a.id, shows: await showsFor(a, cachedGeocode).catch(() => []) });
  }
  // Two at a time: setlist.fm allows about two requests a second.
  await Promise.all([worker(), worker()]);
  return NextResponse.json({ answers });
}
