import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueCampaigns } from "@/lib/pushCampaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sends scheduled announcements whose time has come: every five minutes
// from the database (pg_cron, migration 067, with the push webhook's
// secret) and once a day from Vercel (CRON_SECRET) as a backstop.
async function run(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const ok = [process.env.CRON_SECRET, process.env.PUSH_WEBHOOK_SECRET].some((s) => s && auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await sendDueCampaigns(createAdminClient());
  return NextResponse.json({ ok: true, sent });
}

export const GET = run;
export const POST = run;
