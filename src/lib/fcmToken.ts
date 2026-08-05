import { registerPlugin } from "@capacitor/core";

interface FcmTokenPlugin {
  getToken(): Promise<{ token: string }>;
}

// Local iOS-only native plugin (ios/App/App/FcmTokenPlugin.swift) — see
// that file for why the plugin's own token isn't enough on iOS.
export const FcmToken = registerPlugin<FcmTokenPlugin>("FcmToken");
