import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase";
import type { NotificationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: NotificationKind;
  target_kind: "country" | "event" | null;
  comment_body: string | null;
};

const TITLES: Record<NotificationKind, string> = {
  like: "New like",
  comment: "New comment",
  follow: "New follower",
};

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.PUSH_WEBHOOK_SECRET || auth !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { record } = (await request.json()) as { record: NotificationRow };

  let messaging: ReturnType<typeof getFirebaseMessaging>;
  try {
    messaging = getFirebaseMessaging();
  } catch {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  const admin = createAdminClient();
  const [{ data: actor }, { data: tokens }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", record.actor_id).single(),
    admin.from("device_tokens").select("token").eq("user_id", record.user_id),
  ]);
  if (!tokens || tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const actorName = actor?.display_name ?? "Someone";
  const body =
    record.kind === "follow"
      ? `${actorName} started following you`
      : record.kind === "like"
        ? `${actorName} liked your ${record.target_kind === "country" ? "trip" : "event"}`
        : `${actorName} commented: "${record.comment_body ?? ""}"`;

  const results = await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({
        token: t.token,
        notification: { title: TITLES[record.kind], body },
        data: { kind: record.kind, notificationId: record.id },
      })
    )
  );

  const deadTokens = tokens.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && String(r.reason).includes("registration-token-not-registered");
  });
  if (deadTokens.length > 0) {
    await admin
      .from("device_tokens")
      .delete()
      .in(
        "token",
        deadTokens.map((t) => t.token)
      );
  }

  return NextResponse.json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length });
}
