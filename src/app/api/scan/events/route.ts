import { NextRequest, NextResponse } from "next/server";
import { showsOnDay } from "@/lib/concerts";
import { decide, type MatchedEvent, type MomentQuery, type Show, type VenueKind } from "@/lib/eventMatch";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_MOMENTS = 40;

/**
 * "Find my world" (iPhone app, before or after sign-up): which of these
 * moments were concerts, matches or festivals. Each comes as a day, a town
 * and the names of the venues it was next to (worked out on the phone):
 * no place, no photos, nothing about the person, and nothing is kept.
 */
export async function POST(request: NextRequest) {
  let moments: MomentQuery[];
  try {
    const body = (await request.json()) as { moments?: unknown };
    moments = (Array.isArray(body.moments) ? body.moments : []).slice(0, MAX_MOMENTS).flatMap((m): MomentQuery[] => {
      const x = m as Partial<MomentQuery>;
      if (typeof x.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.day)) return [];
      const venues = (Array.isArray(x.venues) ? x.venues : [])
        .slice(0, 5)
        .flatMap((v) =>
          v && typeof v.name === "string" && "satm".includes(String(v.kind))
            ? [
                {
                  name: v.name.slice(0, 120),
                  kind: v.kind as VenueKind,
                  aka: (Array.isArray(v.aka) ? v.aka : []).filter((n): n is string => typeof n === "string").slice(0, 6).map((n) => n.slice(0, 80)),
                },
              ]
            : []
        );
      return [
        {
          id: String(x.id ?? "").slice(0, 40),
          day: x.day,
          city: typeof x.city === "string" ? x.city.slice(0, 80) : null,
          countryCode: typeof x.countryCode === "string" && /^[A-Z]{2}$/.test(x.countryCode) ? x.countryCode : null,
          venues,
          photos: Math.max(0, Math.min(10_000, Number(x.photos) || 0)),
          hours: Math.max(0, Math.min(48, Number(x.hours) || 0)),
        },
      ];
    });
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const events: MatchedEvent[] = [];
  // Two at a time: setlist.fm allows a couple of requests a second.
  const queue = [...moments];
  async function worker() {
    for (let m = queue.shift(); m; m = queue.shift()) {
      let shows: Show[] = [];
      if (m.city && process.env.SETLISTFM_API_KEY) shows = await showsOnDay(m.city, m.day, m.countryCode, 2).catch(() => []);
      const e = decide(m, shows);
      if (e) events.push(e);
    }
  }
  await Promise.all([worker(), worker()]);
  return NextResponse.json({ events });
}
