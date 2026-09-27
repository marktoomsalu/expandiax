import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/places";

// City suggestions for changing "Happening near …" (feed) and the Explore
// city — open to signed-out visitors too, since Explore is. Only the typed
// text goes to Open-Meteo, and answers are cached for a week.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 80) ?? "";
  return NextResponse.json({ places: await searchPlaces(q).catch(() => []) });
}
