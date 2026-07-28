"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform } from "@/lib/capacitor";

export function PushRegistration({ userId }: { userId: string }) {
  useEffect(() => {
    if (!isNativePlatform()) return;
    const supabase = createClient();

    const registrationListener = PushNotifications.addListener("registration", async (token) => {
      await supabase.from("device_tokens").upsert(
        {
          user_id: userId,
          token: token.value,
          platform: Capacitor.getPlatform() as "ios" | "android",
        },
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
