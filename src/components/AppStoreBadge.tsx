"use client";

import { useSyncExternalStore } from "react";
import { isNativeUserAgent } from "@/lib/nativeApp";
import { cn } from "@/lib/utils";

import { APP_STORE_URL } from "@/lib/appStore";

export { APP_STORE_ID, APP_STORE_URL } from "@/lib/appStore";

const inApp = () => isNativeUserAgent(navigator.userAgent);

/**
 * Apple's official "Download on the App Store" badge (unaltered, as Apple
 * requires: black on light, white on dark). Never shown inside the app
 * itself, where it would point at what you're already using.
 */
export function AppStoreBadge({ className, height = 44 }: { className?: string; height?: number }) {
  const hidden = useSyncExternalStore(() => () => {}, inApp, () => false);
  if (hidden) return null;
  const width = Math.round((height * 119.66407) / 40);
  return (
    <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Download ExpandiaX on the App Store" className={cn("inline-block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-store-badge-black.svg" alt="" width={width} height={height} className="dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-store-badge-white.svg" alt="" width={width} height={height} className="hidden dark:block" />
    </a>
  );
}
