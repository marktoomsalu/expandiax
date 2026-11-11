import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Someone opened an announcement: counts towards its open rate in the admin panel. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { campaignId } = (await request.json()) as { campaignId?: string };
  if (!campaignId || !/^[0-9a-f-]{36}$/.test(campaignId)) return NextResponse.json({ ok: false }, { status: 400 });
  await createAdminClient()
    .from("push_deliveries")
    .update({ opened_at: new Date().toISOString() })
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .is("opened_at", null);
  return NextResponse.json({ ok: true });
}
