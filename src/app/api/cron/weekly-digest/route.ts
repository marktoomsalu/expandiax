import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NotificationKind = "like" | "comment" | "follow";

function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("weekly_digest_enabled", true);
  if (!profiles || profiles.length === 0) return NextResponse.json({ sent: 0, skipped: 0 });

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email]));

  const { data: notifRows } = await supabase
    .from("notifications")
    .select("user_id, kind")
    .gte("created_at", sevenDaysAgo)
    .in(
      "user_id",
      profiles.map((p) => p.id)
    );

  const countsByUser = new Map<string, Record<NotificationKind, number>>();
  for (const row of notifRows ?? []) {
    const counts = countsByUser.get(row.user_id) ?? { like: 0, comment: 0, follow: 0 };
    counts[row.kind as NotificationKind]++;
    countsByUser.set(row.user_id, counts);
  }

  let resend: ReturnType<typeof getResend> | null = null;
  try {
    resend = getResend();
  } catch {
    return NextResponse.json({ error: "Resend isn't set up yet." }, { status: 502 });
  }

  let sent = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const email = emailById.get(profile.id);
    const counts = countsByUser.get(profile.id);
    const total = (counts?.like ?? 0) + (counts?.comment ?? 0) + (counts?.follow ?? 0);
    if (!email || total === 0) {
      skipped++;
      continue;
    }

    const lines: string[] = [];
    if (counts!.follow > 0) lines.push(`${pluralize(counts!.follow, "new follower")}`);
    if (counts!.like > 0) lines.push(`${pluralize(counts!.like, "like")} on your memories`);
    if (counts!.comment > 0) lines.push(`${pluralize(counts!.comment, "new comment")}`);

    try {
      await resend.emails.send({
        from: "ExpandiaX <digest@expandiax.com>",
        to: email,
        subject: "Your week on ExpandiaX",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #17171b;">
            <h1 style="font-size: 20px; font-weight: 600;">Hi ${profile.display_name || profile.username},</h1>
            <p style="font-size: 14px; line-height: 1.6;">Here&rsquo;s what happened on ExpandiaX this week:</p>
            <ul style="font-size: 14px; line-height: 1.8;">
              ${lines.map((l) => `<li>${l}</li>`).join("")}
            </ul>
            <p style="font-size: 14px;">
              <a href="https://expandiax.com/notifications" style="color: #e91e63;">See it all on ExpandiaX</a>
            </p>
            <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">
              Don&rsquo;t want these emails?
              <a href="https://expandiax.com/settings" style="color: #6b7280;">Turn off weekly digests</a>.
            </p>
          </div>
        `,
      });
      sent++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped });
}
