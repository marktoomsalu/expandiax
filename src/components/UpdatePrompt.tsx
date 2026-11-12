"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { MessageCircle, Sparkles } from "lucide-react";
import { hasGlobeTouch } from "@/lib/globeTouch";
import { isNativePlatform } from "@/lib/capacitor";
import { compareVersions, FEATURES_VERSION, storeVersion } from "@/lib/appVersion";
import { APP_STORE_URL } from "@/lib/appStore";
import { tapLight } from "@/lib/haptics";

const LATER_KEY = "expandiax:update-later";
const LATER_DAYS = 3;
const QUIET = ["/touch", "/start", "/sign-in", "/sign-up", "/onboarding", "/join"];

/**
 * In the older iPhone app, once the App Store has a newer version with
 * Chat and World Connect (1.1 or later): "Update" to the App Store.
 * "Later" waits a few days. Never before the new version is out.
 */
export function UpdatePrompt() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isNativePlatform() || Capacitor.getPlatform() !== "ios" || hasGlobeTouch()) return;
    if (QUIET.some((p) => path.startsWith(p))) return;
    try {
      if (Date.now() < Number(localStorage.getItem(LATER_KEY) ?? 0)) return;
    } catch {
      // No storage: ask anyway.
    }
    let alive = true;
    void (async () => {
      const [store, installed] = await Promise.all([storeVersion(), App.getInfo().then((i) => i.version).catch(() => "1.0")]);
      if (!alive || !store) return;
      if (compareVersions(store, FEATURES_VERSION) >= 0 && compareVersions(store, installed) > 0) setOpen(true);
    })();
    return () => {
      alive = false;
    };
  }, [path.startsWith("/start") || path.startsWith("/sign")]); // eslint-disable-line react-hooks/exhaustive-deps

  function later() {
    tapLight();
    try {
      localStorage.setItem(LATER_KEY, String(Date.now() + LATER_DAYS * 86_400_000));
    } catch {
      // Fine.
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-[rgba(10,2,14,0.74)]" role="dialog" aria-modal="true" aria-labelledby="update-h">
      <div
        className="w-full max-w-md rounded-t-[28px] px-6 pt-7 text-center text-white"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="mx-auto flex justify-center gap-3" aria-hidden>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}>
            <MessageCircle size={26} />
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, #7c1d6f, #fa51a2)" }}>
            <Sparkles size={26} />
          </span>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">A new version is here</p>
        <h2 id="update-h" className="mt-2 font-serif text-3xl leading-tight">
          Chat and World Connect
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-white/75">
          Write to friends, send postcards, and hold your iPhones together to connect your worlds. Update ExpandiaX to get them.
        </p>
        <a
          href={APP_STORE_URL}
          onClick={() => setOpen(false)}
          className="mt-7 block w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]"
          style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
        >
          Update
        </a>
        <button type="button" onClick={later} className="mt-3 w-full rounded-full py-3 text-white/70">
          Later
        </button>
      </div>
    </div>
  );
}
