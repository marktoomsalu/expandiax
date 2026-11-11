"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform } from "@/lib/capacitor";
import { FcmToken } from "@/lib/fcmToken";

export function PushRegistration({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!isNativePlatform()) return;
    const supabase = createClient();

    const registrationListener = PushNotifications.addListener("registration", async (token) => {
      const platform = Capacitor.getPlatform() as "ios" | "android";
      // iOS: the plugin's own token is the raw APNs token, which Firebase's
      // Admin SDK can't send to directly — fetch the real FCM token that
      // Firebase's iOS SDK derives from it instead (see AppDelegate.swift).
      let value = token.value;
      if (platform === "ios") {
        try {
          value = (await FcmToken.getToken()).token;
        } catch {
          return; // FCM token isn't ready yet — nothing to store.
        }
      }
      // With the phone's time zone, for quiet hours (migration 068; without it if that isn't there yet).
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      const { error } = await supabase.from("device_tokens").upsert({ user_id: userId, token: value, platform, timezone }, { onConflict: "token" });
      if (error) await supabase.from("device_tokens").upsert({ user_id: userId, token: value, platform }, { onConflict: "token" });
    });
    // Tapping a notification opens what it's about (the link /api/push/send adds).
    const tapListener = PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const data = notification.data as { link?: string; campaignId?: string; logId?: string } | undefined;
      const link = data?.link;
      // Count the open: an announcement's open rate, and "seen", so the next like may buzz again.
      if (data?.campaignId || data?.logId) {
        void fetch("/api/push/opened", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: data.campaignId, logId: data.logId }) }).catch(() => {});
      }
      router.push(link && link.startsWith("/") ? link : "/notifications");
    });
    const errorListener = PushNotifications.addListener("registrationError", () => {
      // Graceful degradation — push just won't work for this device.
    });

    PushNotifications.requestPermissions().then((result) => {
      if (result.receive === "granted") PushNotifications.register();
    });

    return () => {
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      tapListener.then((l) => l.remove());
    };
  }, [userId, router]);

  return null;
}
