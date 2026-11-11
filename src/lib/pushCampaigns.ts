import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "firebase-admin/messaging";
import { getFirebaseMessaging } from "./firebase";
import { inQuietHours, PRIORITY, type PushRules } from "./pushPolicy";
import { loadRules } from "./pushDelivery";

export { fillTemplate } from "./pushTexts";

// Announcements sent from the admin panel (/admin/push), the lowest
// priority of all (P6). The server alone reads and writes these tables
// (migrations 067-068), with the service key. Rules (lib/pushPolicy):
//  - only people who allow this kind in Settings;
//  - reminders and announcements together at most `lowPerDay` a day each;
//  - nobody is woken: where it's quiet hours now, it waits for their
//    morning (push_deliveries.sent_at stays empty until then).

export type PushCategory = "push_updates" | "push_reminders";
export type Audience = { platform?: "ios" | "android"; country?: string; activeDays?: number };
export type Campaign = {
  id: string;
  title: string;
  body: string;
  link: string;
  category: PushCategory;
  audience: Audience;
  status: "scheduled" | "sending" | "sent" | "cancelled" | "failed";
  send_at: string;
  sent_at: string | null;
};

type Token = { user_id: string; token: string; platform: "ios" | "android"; timezone: string | null };

async function tokens(admin: SupabaseClient, platform?: "ios" | "android") {
  const q = (cols: string) => {
    const base = admin.from("device_tokens").select(cols).order("updated_at", { ascending: false });
    return (platform ? base.eq("platform", platform) : base).limit(100000);
  };
  const withZone = await q("user_id, token, platform, timezone");
  if (!withZone.error) return (withZone.data ?? []) as unknown as Token[];
  const { data } = await q("user_id, token, platform");
  return ((data ?? []) as unknown as Token[]).map((t) => ({ ...t, timezone: null }));
}

/** How many reminders and announcements each person got in the last day. */
async function lowToday(admin: SupabaseClient) {
  const since = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const counts = new Map<string, number>();
  const log = await admin.from("push_log").select("user_id").gte("priority", 5).in("outcome", ["sent", "silent"]).gte("created_at", since).limit(100000);
  if (!log.error) {
    for (const r of log.data ?? []) counts.set(r.user_id as string, (counts.get(r.user_id as string) ?? 0) + 1);
    return counts;
  }
  // Before migration 068: announcements only.
  const { data } = await admin.from("push_deliveries").select("user_id").gte("sent_at", since).limit(100000);
  for (const r of data ?? []) counts.set(r.user_id as string, (counts.get(r.user_id as string) ?? 0) + 1);
  return counts;
}

/**
 * Who would get an announcement: everyone with the app's notifications
 * on, who allows this kind in Settings, matches the audience, and hasn't
 * had their daily share of reminders and announcements. With their
 * devices, split into now and (quiet hours) their morning.
 */
export async function recipients(admin: SupabaseClient, category: PushCategory, audience: Audience, rules?: PushRules) {
  const r = rules ?? (await loadRules(admin));
  let profiles = admin.from("profiles").select("id").eq(category, true);
  if (audience.country) profiles = profiles.eq("home_country_code", audience.country.toUpperCase());
  const [{ data: people }, allTokens, had, active] = await Promise.all([
    profiles.limit(100000),
    tokens(admin, audience.platform),
    lowToday(admin),
    audience.activeDays
      ? admin.from("activity_days").select("user_id").gte("day", new Date(Date.now() - audience.activeDays * 86_400_000).toISOString().slice(0, 10)).limit(200000)
      : Promise.resolve({ data: null as { user_id: string }[] | null }),
  ]);
  const allowed = new Set((people ?? []).map((p) => p.id as string));
  const activeSet = active.data ? new Set(active.data.map((x) => x.user_id as string)) : null;
  const byUser = new Map<string, Token[]>();
  const skipped = new Set<string>();
  for (const t of allTokens) {
    if (!allowed.has(t.user_id) || (activeSet && !activeSet.has(t.user_id))) continue;
    if ((had.get(t.user_id) ?? 0) >= r.lowPerDay) {
      skipped.add(t.user_id);
      continue;
    }
    byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);
  }
  const now = new Date();
  // Their newest phone's time zone stands for them.
  const sleeping = new Set([...byUser.entries()].filter(([, ts]) => inQuietHours(r, ts[0].timezone, now)).map(([id]) => id));
  // people: who'd get it; skippedRecently: had their share today; quietNow: will get it in their morning.
  return { byUser, sleeping, people: byUser.size, skippedRecently: skipped.size, quietNow: sleeping.size };
}

function message(c: Pick<Campaign, "id" | "title" | "body" | "link">, token: string): Message {
  return {
    token,
    notification: { title: c.title, body: c.body },
    data: { kind: "campaign", campaignId: c.id, link: c.link },
    apns: { payload: { aps: { sound: "default" } } },
    android: { notification: { sound: "default" } },
  };
}

/** Sends to these people's phones in batches; who it reached, and the counts. */
async function deliver(admin: SupabaseClient, c: Pick<Campaign, "id" | "title" | "body" | "link">, people: [string, Token[]][]) {
  const messaging = getFirebaseMessaging();
  const sends = people.flatMap(([userId, ts]) => ts.map((t) => ({ userId, token: t.token })));
  let delivered = 0;
  let failed = 0;
  const dead: string[] = [];
  const reached = new Set<string>();
  for (let i = 0; i < sends.length; i += 500) {
    const chunk = sends.slice(i, i + 500);
    const res = await messaging.sendEach(chunk.map(({ token }) => message(c, token)));
    res.responses.forEach((r, j) => {
      if (r.success) {
        delivered++;
        reached.add(chunk[j].userId);
      } else {
        failed++;
        if (String(r.error?.code ?? "").includes("registration-token-not-registered")) dead.push(chunk[j].token);
      }
    });
  }
  if (dead.length) await admin.from("device_tokens").delete().in("token", dead);
  if (reached.size) {
    await admin.from("push_log").insert(
      [...reached].map((user_id) => ({ user_id, kind: "campaign", priority: PRIORITY.campaign, ref_id: c.id, outcome: "sent", title: c.title, body: c.body }))
    );
  }
  return { delivered, failed, reached };
}

/** Sends one campaign now (if it's still waiting), and records the results. */
export async function sendCampaign(admin: SupabaseClient, id: string) {
  // Claim it, so two runs never send the same one twice.
  const { data: claimed } = await admin.from("push_campaigns").update({ status: "sending" }).eq("id", id).eq("status", "scheduled").select("*").maybeSingle();
  if (!claimed) return null;
  const c = claimed as Campaign;
  try {
    const { byUser, sleeping } = await recipients(admin, c.category, c.audience ?? {});
    const awake = [...byUser.entries()].filter(([u]) => !sleeping.has(u));
    const { delivered, failed, reached } = await deliver(admin, c, awake);
    const now = new Date().toISOString();
    const rows = [...[...reached].map((user_id) => ({ campaign_id: c.id, user_id, sent_at: now })), ...[...sleeping].map((user_id) => ({ campaign_id: c.id, user_id, sent_at: null }))];
    if (rows.length) {
      const { error } = await admin.from("push_deliveries").insert(rows);
      // Before migration 068 sent_at can't wait: just the ones sent now.
      if (error && sleeping.size) await admin.from("push_deliveries").insert(rows.filter((r) => r.sent_at));
    }
    const done = { status: "sent", sent_at: now, recipients: byUser.size, delivered, failed };
    const { error: updateError } = await admin.from("push_campaigns").update({ ...done, ...(sleeping.size ? { waiting: sleeping.size } : {}) }).eq("id", c.id);
    // Before migration 068 there's no waiting column.
    if (updateError) await admin.from("push_campaigns").update(done).eq("id", c.id);
    return { recipients: byUser.size, delivered, failed, waiting: sleeping.size };
  } catch (e) {
    await admin.from("push_campaigns").update({ status: "failed", error: e instanceof Error ? e.message : String(e) }).eq("id", c.id);
    return null;
  }
}

/** Announcements held back for the night: sent once it's morning where each person is (within a day). */
export async function sendWaiting(admin: SupabaseClient) {
  const { data, error } = await admin.from("push_deliveries").select("campaign_id, user_id").is("sent_at", null).limit(2000);
  if (error || !data?.length) return 0;
  const rules = await loadRules(admin);
  const now = new Date();
  const byCampaign = new Map<string, string[]>();
  for (const d of data) byCampaign.set(d.campaign_id as string, [...(byCampaign.get(d.campaign_id as string) ?? []), d.user_id as string]);
  const all = await tokens(admin);
  let sent = 0;
  for (const [campaignId, users] of byCampaign) {
    const { data: c } = await admin.from("push_campaigns").select("id, title, body, link, sent_at, delivered, failed, waiting").eq("id", campaignId).maybeSingle();
    if (!c) continue;
    const stale = !c.sent_at || now.getTime() - Date.parse(c.sent_at as string) > 24 * 3_600_000;
    const ready: [string, Token[]][] = [];
    const dropped: string[] = [];
    for (const u of users) {
      const ts = all.filter((t) => t.user_id === u);
      if (stale || !ts.length) dropped.push(u);
      else if (!inQuietHours(rules, ts[0].timezone, now)) ready.push([u, ts]);
    }
    if (!ready.length && !dropped.length) continue;
    const { delivered, failed, reached } = ready.length ? await deliver(admin, c as Pick<Campaign, "id" | "title" | "body" | "link">, ready) : { delivered: 0, failed: 0, reached: new Set<string>() };
    if (reached.size) await admin.from("push_deliveries").update({ sent_at: now.toISOString() }).eq("campaign_id", campaignId).in("user_id", [...reached]);
    const gone = [...dropped, ...ready.map(([u]) => u).filter((u) => !reached.has(u))];
    if (gone.length) await admin.from("push_deliveries").delete().eq("campaign_id", campaignId).is("sent_at", null).in("user_id", gone);
    await admin
      .from("push_campaigns")
      .update({
        delivered: (c.delivered as number) + delivered,
        failed: (c.failed as number) + failed,
        waiting: Math.max(0, (c.waiting as number) - reached.size - gone.length),
      })
      .eq("id", campaignId);
    sent += reached.size;
  }
  return sent;
}

/** Sends every campaign whose time has come. */
export async function sendDueCampaigns(admin: SupabaseClient) {
  const { data } = await admin.from("push_campaigns").select("id").eq("status", "scheduled").lte("send_at", new Date().toISOString()).order("send_at").limit(10);
  for (const c of data ?? []) await sendCampaign(admin, c.id as string);
  return (data ?? []).length;
}
