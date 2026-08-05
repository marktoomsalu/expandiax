"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform } from "@/lib/capacitor";
import { FcmToken } from "@/lib/fcmToken";

export function PushRegistration({ userId }: { userId: string }) {
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
      await supabase.from("device_tokens").upsert(
        { user_id: userId, token: value, platform },
        { onConflict: "token" }
      );
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
    };
  }, [userId]);

  return null;
}
