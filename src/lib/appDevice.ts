import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform } from "@/lib/capacitor";

export type PushStatus = "granted" | "denied" | "prompt";

/** Whether this phone lets ExpandiaX send notifications (null outside the app). */
export async function pushStatus(): Promise<PushStatus | null> {
  if (!isNativePlatform()) return null;
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch {
    return null;
  }
}

const SEEN = "expandiax:app-seen";

/**
 * In the app: notes that this person uses it on this platform, its version,
 * and whether notifications are on (migration 081), at most once a day
 * unless that changes. For the dashboard's "app users · notifications on".
 */
export async function noteAppDevice(userId: string, status?: PushStatus | null) {
  if (!isNativePlatform()) return;
  const now = status ?? (await pushStatus()) ?? "prompt";
  const day = new Date().toISOString().slice(0, 10);
  const stamp = `${userId}|${day}|${now}`;
  try {
    if (localStorage.getItem(SEEN) === stamp) return;
  } catch {}
  const platform = Capacitor.getPlatform() as "ios" | "android";
  const version = await App.getInfo().then((i) => `${i.version} (${i.build})`).catch(() => null);
  const { error } = await createClient()
    .from("app_devices")
    .upsert({ user_id: userId, platform, app_version: version, notifications: now, last_seen_at: new Date().toISOString() }, { onConflict: "user_id,platform" });
  if (!error) {
    try {
      localStorage.setItem(SEEN, stamp);
    } catch {}
  }
}
