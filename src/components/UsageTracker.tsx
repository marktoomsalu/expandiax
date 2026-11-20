"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageKey } from "@/lib/usage";
import { flushUsage, noteUsage } from "@/lib/usageClient";

const TICK_MS = 15_000;
const IDLE_MS = 120_000;
const NEW_VISIT_AFTER_MS = 5 * 60_000;

/**
 * Anonymous usage totals (migration 086): the kind of page opened, and time
 * in the app. Time counts only while the app is on screen and someone has
 * touched it in the last two minutes; a new visit starts after five minutes
 * away. Kept in memory only: nothing is stored on the device.
 */
export function UsageTracker() {
  const pathname = usePathname();
  // Feed and Explore share an address and differ by ?tab=, so that counts too.
  const tab = useSearchParams().get("tab");

  useEffect(() => {
    const key = pageKey(pathname, tab ? `?tab=${tab}` : "");
    if (key) noteUsage({ kind: "page", key });
  }, [pathname, tab]);

  useEffect(() => {
    let lastTouch = Date.now();
    let hiddenAt: number | null = null;
    let seconds = 0;
    noteUsage({ kind: "visit", key: "visits" });

    const touch = () => (lastTouch = Date.now());
    const sendTime = (beacon: boolean) => {
      if (seconds >= 1) noteUsage({ kind: "visit", key: "seconds", amount: Math.round(seconds) });
      seconds = 0;
      flushUsage(beacon);
    };
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastTouch < IDLE_MS) seconds += TICK_MS / 1000;
      if (seconds >= 300) sendTime(false);
    }, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        sendTime(true);
      } else {
        if (hiddenAt && Date.now() - hiddenAt >= NEW_VISIT_AFTER_MS) noteUsage({ kind: "visit", key: "visits" });
        hiddenAt = null;
        touch();
      }
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => sendTime(true));
    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
