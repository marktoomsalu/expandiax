import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/;

/**
 * Someone tapped a notification. An announcement counts towards its open
 * rate in the admin panel; any notification counts as seen, so the next
 * like or follower may buzz again instead of quietly joining it.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { campaignId, logId } = (await request.json()) as { campaignId?: string; logId?: string };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (campaignId && UUID.test(campaignId)) {
    await admin.from("push_deliveries").update({ opened_at: now }).eq("campaign_id", campaignId).eq("user_id", user.id).is("opened_at", null);
    await admin.from("push_log").update({ opened_at: now }).eq("ref_id", campaignId).eq("user_id", user.id).is("opened_at", null);
  }
  if (logId && UUID.test(logId)) {
    // The whole group: an updated notification stands for the one it replaced.
    const { data: row } = await admin.from("push_log").select("group_key").eq("id", logId).eq("user_id", user.id).maybeSingle();
    if (row?.group_key) await admin.from("push_log").update({ opened_at: now }).eq("user_id", user.id).eq("group_key", row.group_key).is("opened_at", null);
    else await admin.from("push_log").update({ opened_at: now }).eq("id", logId).eq("user_id", user.id).is("opened_at", null);
  }
  return NextResponse.json({ ok: true });
}
