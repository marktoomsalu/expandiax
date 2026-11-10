"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { getServerState, getState, hasGlobeTouch, startTouch, stopTouch, subscribe } from "@/lib/globeTouch";
import { isTouchReady } from "@/lib/globeTouchReady";

/**
 * Touch globes from anywhere: once you've used it, the app listens while
 * it's open, and a touch on any screen opens Touch globes with that touch.
 * Only for phones that measure distance (no knocks in your pocket), and
 * only for a real approach (see decideTouch).
 */
export function GlobeTouchListener() {
  const path = usePathname();
  const router = useRouter();
  const touch = useSyncExternalStore(subscribe, () => getState().touch, () => getServerState().touch);
  const onScreen = path === "/touch";

  useEffect(() => {
    if (onScreen || !hasGlobeTouch() || !isTouchReady()) return;
    void startTouch("background");
    const sub = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void startTouch("background");
      else void stopTouch();
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [onScreen]);

  useEffect(() => {
    if (touch && !onScreen) router.push("/touch");
  }, [touch, onScreen, router]);

  return null;
}
