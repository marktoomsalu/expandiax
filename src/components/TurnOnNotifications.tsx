"use client";

import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { BellRing, Loader2 } from "lucide-react";
import { noteAppDevice, pushStatus, type PushStatus } from "@/lib/appDevice";
import { tapSuccess } from "@/lib/haptics";

/**
 * In the app, while notifications are off: why they're worth it and one way
 * to turn them on. Not asked yet: the phone's own question. Said "Don't
 * Allow" before (the phone won't ask again): where the switch is, and on an
 * iPhone, straight to it. Checked again on returning to the app, so it goes
 * away as soon as they're on.
 */
export function TurnOnNotifications({ userId, className = "" }: { userId: string; className?: string }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const s = await pushStatus();
    setStatus(s);
    if (s) void noteAppDevice(userId, s);
  }, [userId]);

  useEffect(() => {
    void check();
    const sub = App.addListener("resume", () => void check()).catch(() => null);
    return () => {
      void sub.then((h) => h?.remove());
    };
  }, [check]);

  if (!status || status === "granted") return null;
  const ios = Capacitor.getPlatform() === "ios";

  async function turnOn() {
    setBusy(true);
    try {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive === "granted") {
        tapSuccess();
        await PushNotifications.register();
      }
    } catch {}
    setBusy(false);
    await check();
  }

  return (
    <section className={`flex gap-3 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <BellRing size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Turn on notifications</p>
        <p className="mt-0.5 text-sm text-muted">
          {status === "denied"
            ? ios
              ? "They're off for ExpandiaX. Open Settings, tap Notifications and turn on Allow Notifications."
              : "They're off for ExpandiaX. In your phone's Settings: Apps, ExpandiaX, Notifications."
            : "Know when friends add you to a trip, share a memory, comment or message you."}
        </p>
        {status === "denied" && ios ? (
          <a href="app-settings:" className="btn-accent mt-3 inline-flex !py-2 text-sm">
            Open Settings
          </a>
        ) : (
          <button type="button" onClick={() => void turnOn()} disabled={busy} className="btn-accent mt-3 !py-2 text-sm">
            {busy && <Loader2 size={14} className="animate-spin" />} {status === "denied" ? "Try again" : "Turn on"}
          </button>
        )}
      </div>
    </section>
  );
}
