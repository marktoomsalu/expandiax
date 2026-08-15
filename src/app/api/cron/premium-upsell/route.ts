import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOLDOWN_DAYS = 30;
const MIN_ACCOUNT_AGE_DAYS = 3;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const minAccountAge = new Date(Date.now() - MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: freeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("plan", "free")
    .lte("created_at", minAccountAge);
  if (!freeProfiles || freeProfiles.length === 0) return NextResponse.json({ sent: 0 });

  // Running daily rather than literally once a month spreads sends out
  // across each user's own cooldown window instead of notifying everyone
  // on the same calendar day.
  const { data: recentlyNotified } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("kind", "premium_upsell")
    .gte("created_at", cooldownCutoff)
    .in(
      "user_id",
      freeProfiles.map((p) => p.id)
    );
  const recentlyNotifiedIds = new Set((recentlyNotified ?? []).map((r) => r.user_id));

  const eligible = freeProfiles.filter((p) => !recentlyNotifiedIds.has(p.id));
  if (eligible.length === 0) return NextResponse.json({ sent: 0 });

  // No real actor for a system/marketing notification — actor_id is
  // not-null with an FK to profiles, so self-reference it; the UI
  // special-cases kind === "premium_upsell" and never actually reads the
  // actor's name/avatar for this kind.
  const { error } = await supabase.from("notifications").insert(
    eligible.map((p) => ({ user_id: p.id, actor_id: p.id, kind: "premium_upsell" as const }))
  );
  if (error) return NextResponse.json({ error: "Could not send notifications." }, { status: 502 });

  return NextResponse.json({ sent: eligible.length });
}
