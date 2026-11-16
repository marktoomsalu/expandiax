"use client";

import { useSyncExternalStore } from "react";
import { isNativeUserAgent } from "@/lib/nativeApp";
import { cn } from "@/lib/utils";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appStore";

export { APP_STORE_ID, APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appStore";

const noSubscribe = () => () => {};
const inApp = () => isNativeUserAgent(navigator.userAgent);

type Device = "app" | "ios" | "android" | "other";
function device(): Device {
  const ua = navigator.userAgent;
  if (isNativeUserAgent(ua)) return "app";
  // iPads ask for the desktop site and say "Macintosh"; touch gives them away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/**
 * Apple's official "Download on the App Store" badge (unaltered, as Apple
 * requires: black on light, white on dark). Never shown inside the app
 * itself, where it would point at what you're already using.
 */
export function AppStoreBadge({ className, height = 44 }: { className?: string; height?: number }) {
  const hidden = useSyncExternalStore(noSubscribe, inApp, () => false);
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

// Google's badge image (646×250) carries its own clear space around the
// badge itself (564×168, 41px in from each edge). It's shown unaltered, as
// Google requires, and pulled in by that margin so the visible badge is
// `height` tall and lines up with Apple's.
const PLAY = { w: 646, h: 250, badge: 168, pad: 41 };

/** Google's official "Get it on Google Play" badge. Never shown inside the app. */
export function GooglePlayBadge({ className, height = 44 }: { className?: string; height?: number }) {
  const hidden = useSyncExternalStore(noSubscribe, inApp, () => false);
  if (hidden) return null;
  const scale = height / PLAY.badge;
  const pad = Math.round(PLAY.pad * scale);
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get ExpandiaX on Google Play"
      className={cn("inline-block", className)}
      style={{ margin: -pad }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/google-play-badge.png" alt="" width={Math.round(PLAY.w * scale)} height={Math.round(PLAY.h * scale)} />
    </a>
  );
}

/**
 * Where to get the app: on an iPhone the App Store, on an Android phone
 * Google Play, anywhere else both. Nothing inside the app itself.
 */
export function StoreBadges({ className, height = 44 }: { className?: string; height?: number }) {
  const d = useSyncExternalStore(noSubscribe, device, () => "other" as Device);
  if (d === "app") return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {d !== "android" && <AppStoreBadge height={height} />}
      {d !== "ios" && <GooglePlayBadge height={height} />}
    </div>
  );
}
