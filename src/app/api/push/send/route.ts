import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase";
import { NATIVE_IAP_LIVE } from "@/lib/nativeApp";
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
  follow_request: "Follow request",
  follow_accepted: "Follow request accepted",
  premium_upsell: "Go Premium",
};

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.PUSH_WEBHOOK_SECRET || auth !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { record } = (await request.json()) as { record: NotificationRow };

  // Push only ever reaches the native app, where Premium can't be bought
  // until its in-app subscription ships — an upsell there would point at the
  // web checkout (App Review 3.1.1). The in-app notification row still
  // exists for the website.
  if (record.kind === "premium_upsell" && !NATIVE_IAP_LIVE) return NextResponse.json({ ok: true, sent: 0, reason: "iap_not_live" });

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
  const body = (() => {
    switch (record.kind) {
      case "follow":
        return `${actorName} started following you`;
      case "like":
        return `${actorName} liked your ${record.target_kind === "country" ? "trip" : "event"}`;
      case "follow_request":
        return `${actorName} wants to follow you`;
      case "follow_accepted":
        return `${actorName} accepted your follow request`;
      case "premium_upsell":
        return "Unlimited countries & events, more photos and videos, and US States tracking.";
      default:
        return `${actorName} commented: "${record.comment_body ?? ""}"`;
    }
  })();

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
