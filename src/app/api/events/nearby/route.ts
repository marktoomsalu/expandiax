import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { artistsSeenLive, nearbyConfigured, nearbyEvents } from "@/lib/concerts";
import { nearbyCards } from "@/lib/nearbyCards";

export const dynamic = "force-dynamic";

// Events near a city someone picked in the feed. Nothing is saved — the
// next visit shows events near wherever they actually are again.
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!nearbyConfigured()) return NextResponse.json({ configured: false, cards: [] });
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Pick a city from the list." }, { status: 400 });
  }
  const supabase = createClient();
  const [events, { data: own }] = await Promise.all([
    nearbyEvents({ lat, lng }).catch(() => []),
    supabase.from("events").select("event_type, title, spotify_artist_name, event_date").eq("user_id", user.id).eq("event_type", "concert"),
  ]);
  return NextResponse.json({ cards: nearbyCards(events, artistsSeenLive(own ?? [], 50)) });
}
