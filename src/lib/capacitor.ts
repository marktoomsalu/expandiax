import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// Matches capacitor.config.ts's appId, and the URL scheme registered in
// ios/App/App/Info.plist (CFBundleURLTypes) and
// android/app/src/main/AndroidManifest.xml (intent-filter). Used as the
// OAuth redirect target so the OS hands control back to the app directly
// instead of relying on an https redirect chain landing back in a browser.
export const NATIVE_APP_SCHEME = "com.expandiax.travelapp";
