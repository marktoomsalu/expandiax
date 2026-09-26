import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { searchPastShows } from "@/lib/concerts";

export const dynamic = "force-dynamic";

// An artist's past shows (setlist.fm), so logging a concert is a tap.
export async function GET(request: NextRequest) {
  if (!(await getAuthUser())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const artist = request.nextUrl.searchParams.get("artist")?.trim().slice(0, 120);
  if (!artist) return NextResponse.json({ shows: [], total: 0, page: 1, perPage: 20 });
  const year = Number(request.nextUrl.searchParams.get("year")) || undefined;
  const page = Math.min(Math.max(Number(request.nextUrl.searchParams.get("page")) || 1, 1), 50);
  try {
    return NextResponse.json(await searchPastShows(artist, { year: year && year >= 1950 && year <= 2100 ? year : undefined, page }));
  } catch (e) {
    if (e instanceof Error && e.message === "not_configured") return NextResponse.json({ configured: false, shows: [] });
    return NextResponse.json({ error: "Couldn't load past shows right now." }, { status: 502 });
  }
}
