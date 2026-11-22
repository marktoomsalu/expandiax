"use client";

import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

type ShareBridge = {
  status(): Promise<{ userId: string | null }>;
  setKey(o: { token: string; userId: string }): Promise<{ saved: boolean }>;
  clearKey(): Promise<{ token: string | null }>;
};
const Native = registerPlugin<ShareBridge>("ShareBridge");

/**
 * Share to ExpandiaX (iPhone build 19 on): keeps the Share button's sheet
 * signed in as whoever is signed in here. Signed in with no key on the phone
 * (or someone else's): a new one. Signed out: the phone's key is removed,
 * and switched off on the server too.
 */
export function NativeShareKey() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios" || !Capacitor.isPluginAvailable("ShareBridge")) return;
    const supabase = createClient();
    let busy = false;

    async function sync(userId: string | null) {
      if (busy) return;
      busy = true;
      try {
        const { userId: onPhone } = await Native.status();
        if (!userId) {
          if (!onPhone) return;
          const { token } = await Native.clearKey();
          if (token) await fetch("/api/share/token", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
          return;
        }
        if (onPhone === userId) return;
        const res = await fetch("/api/share/token", { method: "POST" });
        if (!res.ok) return;
        const key = (await res.json()) as { token: string; userId: string };
        if (key.userId === userId) await Native.setKey(key);
      } catch {
        // Next time the app opens.
      } finally {
        busy = false;
      }
    }

    void supabase.auth.getUser().then(({ data }) => sync(data.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void sync(session?.user?.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
