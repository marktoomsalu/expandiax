import { NextResponse } from "next/server";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Cancel a scheduled announcement before it goes out. Admins only. */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await adminId())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { data } = await createAdminClient().from("push_campaigns").update({ status: "cancelled" }).eq("id", params.id).eq("status", "scheduled").select("id").maybeSingle();
  return data ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "It has already gone out." }, { status: 409 });
}
