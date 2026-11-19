import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePlacement, type PlacementInput } from "@/lib/placementInput";
import { PLACEMENTS_TAG } from "@/lib/sponsorsData";

export const dynamic = "force-dynamic";

/** Add a partner placement (an event or a country card). Admins only. */
export async function POST(request: NextRequest) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const parsed = parsePlacement((await request.json()) as PlacementInput);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await createAdminClient().from("partner_placements").insert({ ...parsed.row, created_by: me }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Couldn't save it. Try again." }, { status: 500 });
  revalidateTag(PLACEMENTS_TAG);
  return NextResponse.json({ ok: true, id: data.id });
}
