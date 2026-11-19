import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePlacement, type PlacementInput } from "@/lib/placementInput";
import { PLACEMENTS_TAG } from "@/lib/sponsorsData";

export const dynamic = "force-dynamic";

/** Change a placement: the whole thing, or just pause / resume it ({ active }). Admins only. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await adminId())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = (await request.json()) as PlacementInput & { onlyActive?: boolean };
  let changes: Record<string, unknown>;
  if (body.onlyActive) changes = { active: !!body.active };
  else {
    const parsed = parsePlacement(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    changes = parsed.row;
  }
  const { error } = await createAdminClient()
    .from("partner_placements")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Couldn't save it. Try again." }, { status: 500 });
  revalidateTag(PLACEMENTS_TAG);
  return NextResponse.json({ ok: true });
}

/** Remove a placement for good (its views and clicks go with it). Admins only. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await adminId())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { error } = await createAdminClient().from("partner_placements").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Couldn't remove it. Try again." }, { status: 500 });
  revalidateTag(PLACEMENTS_TAG);
  return NextResponse.json({ ok: true });
}
