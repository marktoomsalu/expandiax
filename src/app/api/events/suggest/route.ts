import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { lookupPlace } from "@/lib/geocode";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const title = request.nextUrl.searchParams.get("title")?.trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  try {
    const suggestion = await lookupPlace(title);
    return NextResponse.json(suggestion);
  } catch {
    return NextResponse.json({ error: "Could not look that up right now." }, { status: 502 });
  }
}
