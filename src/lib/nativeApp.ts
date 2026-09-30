// Shared by middleware, server components and client components — so no
// next/headers or Capacitor imports here.

/** Appended to the WebView's user agent by capacitor.config.ts (appendUserAgent) — keep the two in sync. */
export const NATIVE_APP_UA_MARKER = "ExpandiaXApp";

export function isNativeUserAgent(userAgent: string | null): boolean {
  return !!userAgent?.includes(NATIVE_APP_UA_MARKER);
}
