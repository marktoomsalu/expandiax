import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { newBadges } from "@/lib/badgeData";

export const dynamic = "force-dynamic";

/** Badges earned since the last celebration (none the very first time: those are recorded quietly). */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ids: [], next: null });
  try {
    return NextResponse.json(await newBadges(createClient(), user.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ids: [], next: null });
  }
}
