"use client";

import { useState } from "react";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { createClient } from "@/lib/supabase/client";
import { isNativePlatform, NATIVE_APP_SCHEME } from "@/lib/capacitor";
import { generateRawNonce, sha256Hex } from "@/lib/apple-nonce";

export function AppleSignInButton({ next = "/my-world", disabled = false }: { next?: string; disabled?: boolean }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);

    if (isNativePlatform()) {
      // Real ASAuthorizationController sheet (Face ID/passcode) instead of
      // Google's in-app-browser + deep-link pattern — no browser shown at
      // all, matching what Apple's own guidelines expect for Sign in with
      // Apple on a native app.
      try {
        const rawNonce = generateRawNonce();
        const hashedNonce = await sha256Hex(rawNonce);
        const result = await SignInWithApple.authorize({
          clientId: NATIVE_APP_SCHEME, // the Bundle ID — native tokens carry this as `aud`, not the web Services ID
          redirectURI: `${location.origin}/auth/callback`,
          scopes: "email name",
          nonce: hashedNonce,
        });
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: result.response.identityToken,
          nonce: rawNonce,
        });
        window.location.href = error ? "/sign-in" : next;
      } catch {
        // User cancelled the sheet — just reset, no error toast needed.
        setBusy(false);
      }
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // Browser navigates away to Apple; no need to reset busy on success.
  }

  return (
    <button type="button" onClick={signIn} disabled={busy || disabled} className="btn-apple w-full disabled:opacity-50">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
      {busy ? "Redirecting…" : "Sign in with Apple"}
    </button>
  );
}
