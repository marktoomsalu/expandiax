import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { searchSportEvents } from "@/lib/wikidata";

// Sport events (races, matches, championships) to fill in when logging one.
export async function GET(request: NextRequest) {
  if (!(await getAuthUser())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 120) ?? "";
  try {
    return NextResponse.json({ events: await searchSportEvents(q) });
  } catch {
    return NextResponse.json({ error: "Couldn't search right now.", events: [] }, { status: 502 });
  }
}
