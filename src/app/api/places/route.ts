import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { searchPlaces } from "@/lib/places";

// City suggestions for changing "Happening near …".
export async function GET(request: NextRequest) {
  if (!(await getAuthUser())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 80) ?? "";
  return NextResponse.json({ places: await searchPlaces(q).catch(() => []) });
}
