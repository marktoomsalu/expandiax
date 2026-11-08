import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { followEmail } from "@/lib/followEmail";
import { unsubscribeUrl } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * "X started following you" by email. Called by the database on every new
 * follow (migration 056), with the same secret as the push webhook. Sends
 * nothing to people who've turned these emails off — in Settings or with
 * the one-click link in an earlier one.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.PUSH_WEBHOOK_SECRET || auth !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { record } = (await request.json()) as { record?: { follower_id: string; followee_id: string } };
  if (!record?.follower_id || !record.followee_id) return NextResponse.json({ ok: true, sent: false, reason: "ignored" });

  const admin = createAdminClient();
  const [{ data: follower }, { data: followee }] = await Promise.all([
    admin.from("profiles").select("username, display_name").eq("id", record.follower_id).maybeSingle(),
    admin.from("profiles").select("username, display_name, follow_email_enabled").eq("id", record.followee_id).maybeSingle(),
  ]);
  if (!follower || !followee) return NextResponse.json({ ok: true, sent: false, reason: "missing_profile" });
  if (!followee.follow_email_enabled) return NextResponse.json({ ok: true, sent: false, reason: "turned_off" });

  const { data: auth_ } = await admin.auth.admin.getUserById(record.followee_id);
  const email = auth_?.user?.email;
  if (!email) return NextResponse.json({ ok: true, sent: false, reason: "no_email" });

  let resend: ReturnType<typeof getResend>;
  try {
    resend = getResend();
  } catch {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  const unsubscribe = unsubscribeUrl(record.followee_id, "follows");
  const { subject, html } = followEmail({
    followerName: follower.display_name || follower.username,
    followerUsername: follower.username,
    followeeName: followee.display_name || followee.username,
    unsubscribe,
  });
  const { error } = await resend.emails.send({
    from: "ExpandiaX <notifications@expandiax.com>",
    to: email,
    subject,
    html,
    // Mail apps show their own one-click "Unsubscribe" from these.
    headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  return NextResponse.json({ ok: !error, sent: !error });
}
