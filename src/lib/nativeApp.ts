// Shared by middleware, server components and client components — so no
// next/headers or Capacitor imports here.

/** Appended to the WebView's user agent by capacitor.config.ts (appendUserAgent) — keep the two in sync. */
export const NATIVE_APP_UA_MARKER = "ExpandiaXApp";

// iOS 1.0 ships without the in-app subscription: Apple requires a first
// subscription to be reviewed together with an app version, and that
// submission was stuck. Until the subscription is live in the app, the
// native app must show no way to buy Premium at all — no links to the web
// checkout, no prices, no upsells (App Review guideline 3.1.1). Set to true
// in the release that ships the subscription; the RevenueCat purchase flow
// in BillingActions is still wired up for that.
export const NATIVE_IAP_LIVE = false;

export function isNativeUserAgent(userAgent: string | null): boolean {
  return !!userAgent?.includes(NATIVE_APP_UA_MARKER);
}

/** The database's cap errors end in "— upgrade to Premium for unlimited."; keep just the limit itself. */
export function withoutUpgradePrompt(message: string): string {
  return `${message.split(" — ")[0].replace(/\.$/, "")}.`;
}
