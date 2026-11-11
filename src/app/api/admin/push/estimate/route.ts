import { NextRequest, NextResponse } from "next/server";
import { adminId } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recipients, type Audience, type PushCategory } from "@/lib/pushCampaigns";

export const dynamic = "force-dynamic";

/** How many people an announcement would reach right now. Admins only. */
export async function POST(request: NextRequest) {
  if (!(await adminId())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = (await request.json()) as { category?: PushCategory; audience?: Audience };
  const { people, skippedRecently } = await recipients(createAdminClient(), body.category === "push_reminders" ? "push_reminders" : "push_updates", body.audience ?? {});
  return NextResponse.json({ people, skippedRecently });
}
