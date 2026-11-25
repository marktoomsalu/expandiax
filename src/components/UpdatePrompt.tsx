"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Image as ImageIcon, Sparkles, Ticket, Video } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { isNativePlatform } from "@/lib/capacitor";
import { compareVersions, FIND_VERSION, storeVersion } from "@/lib/appVersion";
import { APP_STORE_URL } from "@/lib/appStore";
import { tapLight } from "@/lib/haptics";

const LATER_KEY = "expandiax:update-later";
const LATER_DAYS = 3;
const QUIET = ["/touch", "/start", "/sign-in", "/sign-up", "/onboarding", "/join"];

/**
 * In an older iPhone app, once the App Store has a newer version (1.2 or
 * later): what's new in it, Discover my world, and "Update" to the App
 * Store. "Later" waits a few days. Never before the new version is out
 * (not during review or TestFlight), and never in the newest app.
 * `preview`: open, for design previews only.
 */
export function UpdatePrompt({ preview = false }: { preview?: boolean }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(preview);

  useEffect(() => {
    if (preview || !isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
    if (QUIET.some((p) => path.startsWith(p))) return;
    try {
      if (Date.now() < Number(localStorage.getItem(LATER_KEY) ?? 0)) return;
    } catch {
      // No storage: ask anyway.
    }
    let alive = true;
    void (async () => {
      const [store, installed] = await Promise.all([storeVersion(), App.getInfo().then((i) => i.version).catch(() => null)]);
      if (!alive || !store || !installed) return;
      if (compareVersions(store, FIND_VERSION) >= 0 && compareVersions(store, installed) > 0) setOpen(true);
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
  // The camera roll drifting into the finder: what Discover my world does, in a glance.
  const tiles = [
    { icon: ImageIcon, x: -78, y: -16, r: -10 },
    { icon: Video, x: 78, y: -22, r: 9 },
    { icon: Ticket, x: 0, y: -64, r: 0 },
  ];
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-[rgba(10,2,14,0.74)]" role="dialog" aria-modal="true" aria-labelledby="update-h">
      <div
        className="w-full max-w-md rounded-t-[28px] px-6 pt-8 text-center text-white"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="relative mx-auto h-32 w-56" aria-hidden>
          <div className="absolute bottom-[-24px] left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,81,162,0.45)_0%,transparent_68%)]" />
          {tiles.map(({ icon: Icon, x, y, r }, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 -ml-5 -mt-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.1] ring-1 ring-white/25 backdrop-blur-md"
              initial={{ x, y, rotate: r, opacity: 0 }}
              animate={reduce ? { x, y, rotate: r, opacity: 1 } : { x: [x, x * 0.3], y: [y, y * 0.3 + 18], opacity: [0, 1, 0], scale: [1, 0.5] }}
              transition={reduce ? { duration: 0.4 } : { duration: 2, delay: i * 0.6, repeat: Infinity, repeatDelay: 0.8, ease: "easeIn" }}
            >
              <Icon size={18} />
            </motion.span>
          ))}
          <span className="absolute bottom-0 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full shadow-[0_0_40px_6px_rgba(250,81,162,0.55)]" style={{ background: "radial-gradient(circle at 35% 30%, #ffd1e8 0%, #fa51a2 40%, #fb7822 100%)" }}>
            <Sparkles size={28} />
          </span>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">A new version is here</p>
        <h2 id="update-h" className="mt-2 font-serif text-3xl leading-tight">
          Discover <span className="italic text-[#ff8cc6]">my world</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-white/75">Your trips, concerts and matches, found automatically in your camera roll in seconds. Update ExpandiaX to try it.</p>
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
