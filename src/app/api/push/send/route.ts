import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase";
import type { NotificationKind } from "@/lib/types";
import { countryByCode } from "@/lib/countries";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: NotificationKind;
  target_kind: "country" | "event" | "question" | null;
  target_id: string | null;
  comment_body: string | null;
};

const TITLES: Record<NotificationKind, string> = {
  like: "New like",
  comment: "New comment",
  follow: "New follower",
  follow_request: "Follow request",
  follow_accepted: "Follow request accepted",
  question: "A question for you",
  answer: "New answer",
};

// Which Settings switch each kind of notification answers to.
const CATEGORY: Record<NotificationKind, "push_followers" | "push_messages" | "push_activity"> = {
  like: "push_activity",
  comment: "push_activity",
  follow: "push_followers",
  follow_request: "push_followers",
  follow_accepted: "push_followers",
  question: "push_messages",
  answer: "push_messages",
};

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.PUSH_WEBHOOK_SECRET || auth !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { record } = (await request.json()) as { record: NotificationRow };

  // Only the kinds people get pushed about (old rows of retired kinds are skipped).
  if (!(record.kind in TITLES)) return NextResponse.json({ ok: true, sent: 0, reason: "not_pushed" });

  let messaging: ReturnType<typeof getFirebaseMessaging>;
  try {
    messaging = getFirebaseMessaging();
  } catch {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  const admin = createAdminClient();
  const category = CATEGORY[record.kind];
  const [{ data: actor }, { data: tokens }, { data: question }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("display_name, username").eq("id", record.actor_id).single(),
    admin.from("device_tokens").select("token").eq("user_id", record.user_id),
    record.target_kind === "question" && record.target_id
      ? admin.from("place_questions").select("country_code").eq("id", record.target_id).maybeSingle()
      : Promise.resolve({ data: null as { country_code: string } | null }),
    admin.from("profiles").select(category).eq("id", record.user_id).single(),
  ]);
  // Switched off in Settings → Notification settings → Push notifications.
  if ((prefs as Record<string, boolean> | null)?.[category] === false) return NextResponse.json({ ok: true, sent: 0, reason: "muted" });
  if (!tokens || tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Where a tap on the notification takes you.
  const link = record.kind === "follow" && actor?.username ? `/u/${actor.username}` : "/notifications";

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
      case "question":
        return `${actorName} asks about ${countryByCode(question?.country_code)?.name ?? "a place you've been"}: "${record.comment_body ?? ""}"`;
      case "answer":
        return `${actorName} answered: "${record.comment_body ?? ""}"`;
      default:
        return `${actorName} commented: "${record.comment_body ?? ""}"`;
    }
  })();

  const results = await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({
        token: t.token,
        notification: { title: TITLES[record.kind], body },
        data: { kind: record.kind, notificationId: record.id, link },
        apns: { payload: { aps: { sound: "default" } } },
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
