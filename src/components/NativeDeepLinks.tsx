"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform, NATIVE_APP_SCHEME } from "@/lib/capacitor";

export function NativeDeepLinks() {
  useEffect(() => {
    if (!isNativePlatform()) return;

    const listener = App.addListener("appUrlOpen", async ({ url }) => {
      // OAuth (Google) redirects here via our own URL scheme instead of an
      // https URL — see GoogleSignInButton.tsx. There's no server round trip
      // for a custom-scheme URL, so the code has to be exchanged client-side
      // using the PKCE verifier signInWithOAuth already stashed before it
      // opened the in-app browser.
      if (url.startsWith(`${NATIVE_APP_SCHEME}://auth/callback`)) {
        const params = new URL(url).searchParams;
        const code = params.get("code");
        const next = params.get("next") ?? "/onboarding";
        await Browser.close().catch(() => {});
        if (code) {
          const supabase = createClient();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          window.location.href = error ? "/sign-in" : next;
        } else {
          window.location.href = "/sign-in";
        }
        return;
      }

      // Universal Links (email confirm/reset, shared links, etc.) — these
      // are ordinary https URLs already pointing at expandiax.com, so just
      // navigate the existing WebView there.
      window.location.href = url;
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return null;
}
