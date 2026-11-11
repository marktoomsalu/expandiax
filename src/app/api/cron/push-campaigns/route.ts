import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueCampaigns, sendWaiting } from "@/lib/pushCampaigns";
import { sendDueReminders } from "@/lib/pushReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The push schedule: every five minutes from the database (pg_cron,
// migration 067, with the push webhook's secret) and once a day from
// Vercel (CRON_SECRET) as a backstop. Each run sends scheduled
// announcements that are due and ones that waited for someone's morning;
// every half hour (and on the daily run) also the memory reminders.
async function run(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const ok = [process.env.CRON_SECRET, process.env.PUSH_WEBHOOK_SECRET].some((s) => s && auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const campaigns = await sendDueCampaigns(admin);
  const waiting = await sendWaiting(admin).catch(() => 0);
  const daily = auth === `Bearer ${process.env.CRON_SECRET}`;
  const reminders = daily || new Date().getUTCMinutes() % 30 < 5 ? await sendDueReminders(admin).catch(() => 0) : 0;
  return NextResponse.json({ ok: true, campaigns, waiting, reminders });
}

export const GET = run;
export const POST = run;
