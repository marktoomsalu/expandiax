import { headers } from "next/headers";
import { NATIVE_IAP_LIVE, isNativeUserAgent } from "@/lib/nativeApp";

export function isNativeAppRequest(): boolean {
  return isNativeUserAgent(headers().get("user-agent"));
}

/** Whether this request may show any way to buy Premium — false inside the native app until its in-app subscription is live. */
export function canSellPremium(): boolean {
  return NATIVE_IAP_LIVE || !isNativeAppRequest();
}
