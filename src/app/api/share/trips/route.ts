import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shareUser } from "@/lib/shareTokens";
import { PHOTO_CAP, VIDEO_CAP } from "@/lib/plan";

export const dynamic = "force-dynamic";

export type ShareTrip = {
  visitId: string;
  code: string;
  name: string;
  /** yyyy-mm-dd, or null for a trip saved with only a year. */
  from: string | null;
  to: string | null;
  year: number;
  precision: "year" | "month" | "day";
  places: string[];
  photos: number;
  videos: number;
};

export type ShareEvent = {
  eventId: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** The last day, for one that lasts more than a day. */
  endDate: string | null;
  type: string;
  venue: string | null;
  city: string | null;
  code: string | null;
  photos: number;
  videos: number;
};

/**
 * The share sheet opening: their trips and events (newest first) with how many photos
 * and videos each already has, and how many fit, so it can pick the right
 * one and say up front if some won't fit.
 */
export async function GET(request: NextRequest) {
  const userId = await shareUser(request);
  if (!userId) return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const admin = createAdminClient();

  const [{ data: profile }, { data: countries }, { data: eventRows }] = await Promise.all([
    admin.from("profiles").select("home_country_code").eq("id", userId).maybeSingle(),
    admin.from("visited_countries").select("id, country_code, country_name, country_visits(id, year, visited_from, visited_to, date_precision)").eq("user_id", userId),
    admin.from("events").select("id, title, event_date, end_date, event_type, venue, city, country_code").eq("user_id", userId).order("event_date", { ascending: false }).limit(300),
  ]);
  const eventIds = (eventRows ?? []).map((e) => e.id as string);
  const { data: eventMedia } = eventIds.length ? await admin.from("event_media").select("event_id, media_type").in("event_id", eventIds) : { data: [] };
  const eventCounts = new Map<string, { photos: number; videos: number }>();
  for (const m of eventMedia ?? []) {
    const c = eventCounts.get(m.event_id as string) ?? { photos: 0, videos: 0 };
    if (m.media_type === "video") c.videos += 1;
    else c.photos += 1;
    eventCounts.set(m.event_id as string, c);
  }
  const events: ShareEvent[] = (eventRows ?? []).map((e) => ({
    eventId: e.id as string,
    title: (e.title as string) || "Event",
    date: e.event_date as string,
    endDate: (e.end_date as string) || null,
    type: (e.event_type as string) ?? "other",
    venue: (e.venue as string) || null,
    city: (e.city as string) || null,
    code: (e.country_code as string) || null,
    ...(eventCounts.get(e.id as string) ?? { photos: 0, videos: 0 }),
  }));
  const ids = (countries ?? []).map((c) => c.id as string);
  const [{ data: media }, { data: cities }] = ids.length
    ? await Promise.all([
        admin.from("country_media").select("country_visit_id, media_type").in("visited_country_id", ids),
        admin.from("country_cities").select("country_visit_id, city_name, position").in("visited_country_id", ids).order("position"),
      ])
    : [{ data: [] }, { data: [] }];

  const counts = new Map<string, { photos: number; videos: number }>();
  for (const m of media ?? []) {
    const id = m.country_visit_id as string | null;
    if (!id) continue;
    const c = counts.get(id) ?? { photos: 0, videos: 0 };
    if (m.media_type === "video") c.videos += 1;
    else c.photos += 1;
    counts.set(id, c);
  }
  const places = new Map<string, string[]>();
  for (const c of cities ?? []) {
    const id = c.country_visit_id as string | null;
    if (id) places.set(id, [...(places.get(id) ?? []), c.city_name as string]);
  }

  const trips: ShareTrip[] = [];
  for (const c of countries ?? []) {
    for (const v of (c.country_visits ?? []) as { id: string; year: number; visited_from: string | null; visited_to: string | null; date_precision: string | null }[]) {
      trips.push({
        visitId: v.id,
        code: c.country_code as string,
        name: c.country_name as string,
        from: v.visited_from,
        to: v.visited_to ?? v.visited_from,
        year: v.year,
        precision: v.date_precision === "day" || v.date_precision === "month" ? v.date_precision : v.visited_from ? "day" : "year",
        places: (places.get(v.id) ?? []).slice(0, 4),
        ...(counts.get(v.id) ?? { photos: 0, videos: 0 }),
      });
    }
  }
  trips.sort((a, b) => (b.from ?? `${b.year}`).localeCompare(a.from ?? `${a.year}`));

  return NextResponse.json({
    trips: trips.slice(0, 300),
    events,
    // The same for everyone now (migration 053): the fair-use limits.
    caps: { photos: PHOTO_CAP, videos: VIDEO_CAP },
    homeCode: profile?.home_country_code ?? null,
  });
}
