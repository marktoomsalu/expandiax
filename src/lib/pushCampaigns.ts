import type { SupabaseClient } from "@supabase/supabase-js";
import { getFirebaseMessaging } from "./firebase";

// Announcements sent from the admin panel (/admin/push). The server alone
// reads and writes these tables (migration 067), with the service key.

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
};

/** Nobody gets more than one announcement in this long. */
export const ONE_PER_HOURS = 20;

/**
 * Who would get an announcement now: everyone with the app's notifications
 * on, who allows this kind in Settings, matches the audience, and hasn't
 * had an announcement in the last day. With their devices.
 */
export async function recipients(admin: SupabaseClient, category: PushCategory, audience: Audience) {
  let profiles = admin.from("profiles").select("id").eq(category, true);
  if (audience.country) profiles = profiles.eq("home_country_code", audience.country.toUpperCase());
  const [{ data: people }, { data: tokens }, { data: recent }, active] = await Promise.all([
    profiles.limit(100000),
    (audience.platform ? admin.from("device_tokens").select("user_id, token").eq("platform", audience.platform) : admin.from("device_tokens").select("user_id, token")).limit(100000),
    admin.from("push_deliveries").select("user_id").gte("sent_at", new Date(Date.now() - ONE_PER_HOURS * 3_600_000).toISOString()).limit(100000),
    audience.activeDays
      ? admin.from("activity_days").select("user_id").gte("day", new Date(Date.now() - audience.activeDays * 86_400_000).toISOString().slice(0, 10)).limit(200000)
      : Promise.resolve({ data: null as { user_id: string }[] | null }),
  ]);
  const allowed = new Set((people ?? []).map((p) => p.id as string));
  const activeSet = active.data ? new Set(active.data.map((r) => r.user_id as string)) : null;
  const hadOne = new Set((recent ?? []).map((r) => r.user_id as string));
  const byUser = new Map<string, string[]>();
  const skipped = new Set<string>();
  for (const t of (tokens ?? []) as { user_id: string; token: string }[]) {
    if (!allowed.has(t.user_id) || (activeSet && !activeSet.has(t.user_id))) continue;
    if (hadOne.has(t.user_id)) {
      skipped.add(t.user_id);
      continue;
    }
    byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);
  }
  // people: who'd get it; skippedRecently: who'd qualify but had one in the last day.
  return { byUser, people: byUser.size, skippedRecently: skipped.size };
}

/** Sends one campaign now (if it's still waiting), and records the results. */
export async function sendCampaign(admin: SupabaseClient, id: string) {
  // Claim it, so two runs never send the same one twice.
  const { data: claimed } = await admin.from("push_campaigns").update({ status: "sending" }).eq("id", id).eq("status", "scheduled").select("*").maybeSingle();
  if (!claimed) return null;
  const c = claimed as Campaign;
  try {
    const messaging = getFirebaseMessaging();
    const { byUser } = await recipients(admin, c.category, c.audience ?? {});
    const sends = [...byUser.entries()].flatMap(([userId, tokens]) => tokens.map((token) => ({ userId, token })));
    let delivered = 0;
    let failed = 0;
    const dead: string[] = [];
    const reached = new Set<string>();
    for (let i = 0; i < sends.length; i += 500) {
      const chunk = sends.slice(i, i + 500);
      const res = await messaging.sendEach(
        chunk.map(({ token }) => ({
          token,
          notification: { title: c.title, body: c.body },
          data: { kind: "campaign", campaignId: c.id, link: c.link },
          apns: { payload: { aps: { sound: "default" } } },
        }))
      );
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
    if (reached.size) await admin.from("push_deliveries").insert([...reached].map((user_id) => ({ campaign_id: c.id, user_id })));
    await admin
      .from("push_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipients: byUser.size, delivered, failed })
      .eq("id", c.id);
    return { recipients: byUser.size, delivered, failed };
  } catch (e) {
    await admin.from("push_campaigns").update({ status: "failed", error: e instanceof Error ? e.message : String(e) }).eq("id", c.id);
    return null;
  }
}

/** Sends every campaign whose time has come. */
export async function sendDueCampaigns(admin: SupabaseClient) {
  const { data } = await admin.from("push_campaigns").select("id").eq("status", "scheduled").lte("send_at", new Date().toISOString()).order("send_at").limit(10);
  for (const c of data ?? []) await sendCampaign(admin, c.id as string);
  return (data ?? []).length;
}

/** {name}, {text}… filled in; unknown ones left empty. */
export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "").replace(/\s+/g, " ").trim();
}
