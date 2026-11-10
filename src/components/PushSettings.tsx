"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BellOff, Camera, Heart, MessageCircle, Sparkles, UserPlus, type LucideIcon } from "lucide-react";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform } from "@/lib/capacitor";
import { tapLight } from "@/lib/haptics";
import { Switch } from "./Switch";

export type PushColumn = "push_followers" | "push_messages" | "push_activity" | "push_reminders" | "push_updates";

const CATEGORIES: { column: PushColumn; icon: LucideIcon; title: string; body: string }[] = [
  { column: "push_followers", icon: UserPlus, title: "New followers", body: "Get notified when someone starts following you." },
  { column: "push_messages", icon: MessageCircle, title: "New messages", body: "Know when someone sends you a message." },
  { column: "push_activity", icon: Heart, title: "Post activity", body: "Get notified when someone likes or comments on your posts." },
  { column: "push_reminders", icon: Camera, title: "Memory reminders", body: "Gentle reminders to add photos and memories from your past trips and events." },
  { column: "push_updates", icon: Sparkles, title: "Updates & inspiration", body: "Receive special greetings, revisit memories and discover what’s new on ExpandiaX." },
];

type Permission = "granted" | "denied" | "ask" | "unknown";
const never = () => () => {};

/**
 * Push notifications, kind by kind. Turning one on when the iPhone itself
 * has notifications off for ExpandiaX asks iOS first; if iOS has already
 * been told no, only the iPhone's Settings can change that, so we say so.
 */
export function PushSettings({ userId, initial }: { userId: string; initial: Record<PushColumn, boolean> }) {
  const native = useSyncExternalStore(never, isNativePlatform, () => false);
  const [prefs, setPrefs] = useState(initial);
  const [permission, setPermission] = useState<Permission>("unknown");

  useEffect(() => {
    if (!native) return;
    PushNotifications.checkPermissions()
      .then(({ receive }) => setPermission(receive === "granted" ? "granted" : receive === "denied" ? "denied" : "ask"))
      .catch(() => setPermission("unknown"));
  }, [native]);

  async function askIos(): Promise<boolean> {
    if (!native || permission === "granted") return true;
    const { receive } = await PushNotifications.requestPermissions().catch(() => ({ receive: "denied" as const }));
    if (receive === "granted") {
      setPermission("granted");
      // PushRegistration (in the layout) saves the token when it arrives.
      await PushNotifications.register().catch(() => {});
      return true;
    }
    setPermission("denied");
    return false;
  }

  async function change(column: PushColumn, next: boolean) {
    tapLight();
    if (next) await askIos();
    setPrefs((p) => ({ ...p, [column]: next }));
    const { error } = await createClient().from("profiles").update({ [column]: next }).eq("id", userId);
    if (error) setPrefs((p) => ({ ...p, [column]: !next }));
  }

  const off = native && (permission === "denied" || permission === "ask");

  return (
    <div>
      {!native && (
        <p className="mt-1 text-xs text-muted">Push notifications come to the ExpandiaX app on your phone. What you choose here applies there.</p>
      )}
      {off && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
          <BellOff size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            {permission === "ask" ? (
              <>
                <p>Notifications are off on this iPhone.</p>
                <button type="button" onClick={() => void askIos()} className="mt-1 font-medium text-accent hover:underline">
                  Turn on notifications
                </button>
              </>
            ) : (
              <p>
                Notifications are off for ExpandiaX on this iPhone. Turn them on in <b>Settings &rsaquo; Notifications &rsaquo; ExpandiaX</b>, then
                choose what you&rsquo;d like below.
              </p>
            )}
          </div>
        </div>
      )}
      <ul className="mt-2 divide-y divide-line">
        {CATEGORIES.map(({ column, icon: Icon, title, body }) => (
          <li key={column} className="flex items-center gap-3 py-3.5">
            <Icon size={20} className="shrink-0 text-ink" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{body}</p>
            </div>
            <Switch checked={prefs[column]} onChange={(next) => void change(column, next)} label={title} />
          </li>
        ))}
      </ul>
    </div>
  );
}
