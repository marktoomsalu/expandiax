import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "firebase-admin/messaging";
import { getFirebaseMessaging } from "./firebase";
import { DEFAULT_TEXTS } from "./pushTexts";
import { mergeRules, type PushRules } from "./pushPolicy";

// The server side of sending a push: the rules in force, who's looking at
// what right now, the device list, the log, and the send itself in its
// three forms (buzz, silent, update in place). Service key only.

export type Device = { token: string; platform: "ios" | "android"; timezone: string | null };
/** alert: sound and banner. silent: arrives quietly in the list. update: replaces the one already there, quietly. */
export type Mode = "alert" | "silent" | "update";

export async function loadRules(admin: SupabaseClient): Promise<PushRules> {
  const { data } = await admin.from("push_rules").select("rules").maybeSingle();
  return mergeRules(data?.rules);
}

/** Someone's phones, newest first; with their time zone where known (migration 068). */
export async function devicesOf(admin: SupabaseClient, userId: string): Promise<Device[]> {
  const withZone = await admin.from("device_tokens").select("token, platform, timezone").eq("user_id", userId).order("updated_at", { ascending: false });
  if (!withZone.error) return (withZone.data ?? []) as Device[];
  const { data } = await admin.from("device_tokens").select("token, platform").eq("user_id", userId).order("updated_at", { ascending: false });
  return ((data ?? []) as Omit<Device, "timezone">[]).map((d) => ({ ...d, timezone: null }));
}

export type Presence = { seen_at: string; left_at: string | null; screen: string | null; conversation_id: string | null };

/** Their app is open right now (a heartbeat in the last 45 s, and they haven't left since). */
export function isHere(p: Presence | null, now: Date) {
  if (!p) return false;
  const seen = Date.parse(p.seen_at);
  return now.getTime() - seen < 45_000 && (!p.left_at || Date.parse(p.left_at) < seen);
}

export async function presenceOf(admin: SupabaseClient, userId: string): Promise<Presence | null> {
  const { data, error } = await admin.from("push_presence").select("seen_at, left_at, screen, conversation_id").eq("user_id", userId).maybeSingle();
  return error ? null : (data as Presence | null);
}

/** The words for these kinds: the admin panel's, or the defaults. Kinds switched off there come back as null. */
export async function textsFor(admin: SupabaseClient, kinds: string[]) {
  const { data } = await admin.from("push_templates").select("kind, title, body, enabled").in("kind", kinds);
  const rows = new Map((data ?? []).map((r) => [r.kind as string, r as { title: string; body: string; enabled: boolean }]));
  return Object.fromEntries(
    kinds.map((k) => {
      const row = rows.get(k);
      if (row && !row.enabled) return [k, null];
      return [k, row ? { title: row.title, body: row.body } : DEFAULT_TEXTS[k] ?? null];
    })
  ) as Record<string, { title: string; body: string } | null>;
}

/** A row in push_log (if the table is there yet); returns its id. */
export async function logPush(admin: SupabaseClient, row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await admin.from("push_log").insert(row).select("id").single();
  return error ? null : (data.id as string);
}

/**
 * Sends one notification to someone's phones.
 * - alert: the usual sound and banner.
 * - silent: no sound, no banner, straight into the notification list
 *   (iPhone "passive"; low priority on Android).
 * - update: replaces the notification with the same group already on the
 *   phone, silently. iPhones only: Android would buzz again, so Android
 *   phones keep the first one.
 * The group (collapse id / tag) makes later ones replace earlier ones
 * rather than pile up.
 */
export async function sendToDevices(
  admin: SupabaseClient,
  devices: Device[],
  n: { title: string; body: string; group: string | null; mode: Mode; data: Record<string, string> }
) {
  const targets = n.mode === "update" ? devices.filter((d) => d.platform === "ios") : devices;
  if (!targets.length) return { delivered: 0, failed: 0 };
  const messaging = getFirebaseMessaging();
  const quiet = n.mode !== "alert";
  const collapse = n.group ? n.group.slice(0, 64) : undefined;
  const messages: Message[] = targets.map((d) => ({
    token: d.token,
    notification: { title: n.title, body: n.body },
    data: n.data,
    apns: {
      headers: collapse ? { "apns-collapse-id": collapse } : undefined,
      payload: {
        aps: {
          ...(quiet ? {} : { sound: "default" }),
          ...(collapse ? { threadId: collapse } : {}),
          // Passive: no sound, no lighting up, just there in the list.
          ...(quiet ? { "interruption-level": "passive" } : {}),
        },
      },
    },
    android: {
      priority: quiet ? "normal" : "high",
      notification: {
        ...(collapse ? { tag: collapse } : {}),
        ...(quiet ? { notificationPriority: "PRIORITY_LOW" as const } : { sound: "default" }),
      },
    },
  }));
  const res = await messaging.sendEach(messages);
  const dead = res.responses.flatMap((r, i) => (!r.success && String(r.error?.code ?? "").includes("registration-token-not-registered") ? [targets[i].token] : []));
  if (dead.length) await admin.from("device_tokens").delete().in("token", dead);
  return { delivered: res.successCount, failed: res.failureCount };
}
