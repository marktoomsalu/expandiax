import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationKind } from "@/lib/types";
import { countryByCode } from "@/lib/countries";
import { decideSocial, groupKey, inQuietHours, others, PRIORITY, type GroupState } from "@/lib/pushPolicy";
import { devicesOf, isHere, loadRules, logPush, presenceOf, sendToDevices, textsFor } from "@/lib/pushDelivery";
import { fillTemplate, MANY } from "@/lib/pushTexts";

export const dynamic = "force-dynamic";

// Every social push starts here: a new row in notifications (likes,
// comments, follows…; migration 032) or a chat message (migration 064).
// The rules in lib/pushPolicy decide whether it buzzes, quietly updates the
// notification already on the phone ("Alex and 4 others liked your
// memory"), or isn't sent at all; each decision is logged in push_log.

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: PushKind;
  target_kind: "country" | "event" | "question" | "conversation" | null;
  target_id: string | null;
  comment_body: string | null;
};

type PushKind = NotificationKind | "message" | "postcard";
const PUSHED: PushKind[] = ["message", "postcard", "like", "comment", "follow", "follow_request", "follow_accepted", "question", "answer"];

// Which Settings switch each kind of notification answers to.
const CATEGORY: Record<PushKind, "push_followers" | "push_messages" | "push_activity"> = {
  message: "push_messages",
  postcard: "push_messages",
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
  if (!PUSHED.includes(record.kind)) return NextResponse.json({ ok: true, sent: 0, reason: "not_pushed" });

  const admin = createAdminClient();
  const now = new Date();
  const kind = record.kind;
  const isChat = record.target_kind === "conversation";
  const group = groupKey(kind, record.target_kind, record.target_id, record.actor_id);
  const category = CATEGORY[kind];
  const manyKind = MANY[kind];
  const base = { user_id: record.user_id, kind, priority: PRIORITY[kind], group_key: group, ref_id: record.id };

  const [{ data: actor }, devices, { data: question }, { data: owner }, { data: country }, rules, presence, { data: lastAlert }, texts, { data: conv }] = await Promise.all([
    admin.from("profiles").select("display_name, username").eq("id", record.actor_id).single(),
    devicesOf(admin, record.user_id),
    record.target_kind === "question" && record.target_id
      ? admin.from("place_questions").select("country_code").eq("id", record.target_id).maybeSingle()
      : Promise.resolve({ data: null as { country_code: string } | null }),
    admin.from("profiles").select(`username, ${category}`).eq("id", record.user_id).single(),
    record.target_kind === "country" && record.target_id
      ? admin.from("visited_countries").select("country_code").eq("id", record.target_id).maybeSingle()
      : Promise.resolve({ data: null as { country_code: string } | null }),
    loadRules(admin),
    presenceOf(admin, record.user_id),
    // The last one in this group that reached them with a notification of its own.
    admin.from("push_log").select("id, created_at, opened_at, ref_id").eq("user_id", record.user_id).eq("group_key", group).in("outcome", ["sent", "silent"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    textsFor(admin, manyKind ? [kind, manyKind] : [kind]),
    isChat && record.target_id ? admin.from("conversations").select("a, a_read_at, b_read_at").eq("id", record.target_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const ownerRow = owner as unknown as ({ username: string } & Record<string, boolean>) | null;
  // Switched off in Settings → Notification settings → Push notifications.
  if (ownerRow?.[category] === false) return NextResponse.json({ ok: true, sent: 0, reason: "muted" });
  if (!devices.length) return NextResponse.json({ ok: true, sent: 0, reason: "no_device" });
  // Switched off for everyone in the admin panel.
  if (!texts[kind]) {
    await logPush(admin, { ...base, outcome: "skipped", reason: "switched_off" });
    return NextResponse.json({ ok: true, sent: 0, reason: "switched_off" });
  }

  // Where a tap on it takes you: the post itself (straight to its comments
  // for a comment), the question, the chat, or the person.
  const me = ownerRow?.username;
  const link = (() => {
    if (isChat && record.target_id) return `/feed?chat=${record.target_id}`;
    const onComments = kind === "comment" ? "#comments" : "";
    if (record.target_kind === "country" && country && me) return `/u/${me}/countries/${country.country_code.toLowerCase()}`;
    if (record.target_kind === "event" && record.target_id && me) return `/u/${me}/events/${record.target_id}${onComments}`;
    if (record.target_kind === "question" && question && record.target_id) return `/explore/country/${question.country_code.toLowerCase()}#q-${record.target_id}`;
    if (kind.startsWith("follow") && actor?.username) return kind === "follow_request" ? "/notifications" : `/u/${actor.username}`;
    return "/notifications";
  })();

  // Already looking at it: the chat itself, their notifications, or the post.
  const here = isHere(presence, now);
  const viewing =
    here &&
    (isChat ? presence?.conversation_id === record.target_id : presence?.screen === "/notifications" || presence?.screen === link.split(/[?#]/)[0]);

  // Has the last notification in this group been seen? Opened, or what it
  // was about read since (the chat, or the notification in the app).
  let groupState: GroupState = null;
  if (lastAlert) {
    const at = new Date(lastAlert.created_at as string);
    let seen = !!lastAlert.opened_at;
    if (!seen && isChat && conv) {
      const readAt = conv.a === record.user_id ? conv.a_read_at : conv.b_read_at;
      seen = Date.parse(readAt as string) >= at.getTime();
    } else if (!seen && lastAlert.ref_id) {
      const { data: n } = await admin.from("notifications").select("read").eq("id", lastAlert.ref_id).maybeSingle();
      seen = !n || !!n.read;
    }
    groupState = { lastAlertAt: at, seen };
  }

  const quiet = inQuietHours(rules, devices[0]?.timezone, now);
  let decision = decideSocial({ kind, rules, group: groupState, viewing, quiet, now });
  if (decision.action === "skip") {
    await logPush(admin, { ...base, outcome: "skipped", reason: decision.reason });
    return NextResponse.json({ ok: true, sent: 0, reason: decision.reason });
  }

  // Claim it in the log first; two likes in the same second shouldn't both buzz.
  const logId = await logPush(admin, { ...base, outcome: decision.action === "update" ? "updated" : decision.silent ? "silent" : "sent" });
  if (decision.action === "alert" && logId) {
    // Whoever logged first in the last few seconds buzzes; the rest update it.
    const { data: recent } = await admin
      .from("push_log")
      .select("id")
      .eq("user_id", record.user_id)
      .eq("group_key", group)
      .in("outcome", ["sent", "silent"])
      .gte("created_at", new Date(now.getTime() - 15_000).toISOString())
      .order("created_at")
      .order("id")
      .limit(1);
    if (recent?.length && recent[0].id !== logId) {
      decision = { action: "update" };
      await admin.from("push_log").update({ outcome: "updated" }).eq("id", logId);
    }
  }

  // How many it now stands for, when there's more than one.
  const count = await (async () => {
    if (!manyKind) return 1;
    if (isChat) {
      if (!conv || !record.target_id) return 1;
      const readAt = conv.a === record.user_id ? conv.a_read_at : conv.b_read_at;
      const { count: c } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", record.target_id).eq("sender_id", record.actor_id).gt("created_at", readAt as string);
      return Math.max(1, c ?? 1);
    }
    // Since the notification this joins (or, for a new one, just this moment's).
    const since = decision.action === "update" && lastAlert ? Date.parse(lastAlert.created_at as string) - 5_000 : now.getTime() - 60_000;
    let q = admin.from("notifications").select("actor_id").eq("user_id", record.user_id).eq("kind", kind).eq("read", false).gte("created_at", new Date(since).toISOString());
    if (kind !== "follow" && kind !== "follow_request") q = q.eq("target_id", record.target_id ?? "");
    const { data: rows } = await q.limit(500);
    // People, not notifications: someone who commented twice is one person.
    return Math.max(1, new Set((rows ?? []).map((r) => r.actor_id as string)).size);
  })();

  const actorName = actor?.display_name ?? "Someone";
  const values = {
    name: actorName,
    others: others(Math.max(1, count - 1)),
    count: String(count),
    thing: record.target_kind === "country" ? "trip" : "event",
    place: countryByCode(question?.country_code)?.name ?? "a place you've been",
    text: record.comment_body ?? "",
  };
  const words = (count > 1 && manyKind && texts[manyKind]) || texts[kind]!;
  const title = fillTemplate(words.title, values);
  const body = fillTemplate(words.body, values);
  // Several followers open the list of them rather than one person.
  const tapTo = count > 1 && kind.startsWith("follow") ? "/notifications" : link;

  const mode = decision.action === "update" ? "update" : decision.silent ? "silent" : "alert";
  const result = await sendToDevices(admin, devices, {
    title,
    body,
    group,
    mode,
    data: { kind, notificationId: record.id, link: tapTo, ...(logId ? { logId } : {}) },
  });
  if (logId) await admin.from("push_log").update({ title, body, ...(result.delivered === 0 ? { outcome: "skipped", reason: mode === "update" ? "android_keeps_first" : "not_delivered" } : {}) }).eq("id", logId);

  return NextResponse.json({ ok: true, mode, sent: result.delivered });
}
