"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Sparkles } from "lucide-react";
import { hasGlobeTouch } from "@/lib/globeTouch";
import { featuresReleased } from "@/lib/appVersion";
import { claimIntro, releaseIntro } from "@/lib/introQueue";
import { tapLight } from "@/lib/haptics";

const SEEN_KEY = "expandiax:whats-new:1.1";
const QUIET = ["/touch", "/start", "/sign-in", "/sign-up", "/onboarding", "/join"];

/**
 * Once, in the new iPhone app (1.1), when 1.1 is out on the App Store:
 * what's new, Chat and World Connect. It goes before the World Connect card
 * (lib/introQueue), which follows with its spotlight and Turn on.
 */
export function WhatsNew() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasGlobeTouch() || QUIET.some((p) => path.startsWith(p))) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    // Hold the World Connect card back while we find out.
    if (!claimIntro("whats-new")) return;
    let alive = true;
    void featuresReleased().then((out) => {
      if (!alive) return;
      if (out) setOpen(true);
      else releaseIntro("whats-new");
    });
    return () => {
      alive = false;
    };
    // Once per app start (and when leaving a quiet screen).
  }, [path.startsWith("/start") || path.startsWith("/sign")]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    tapLight();
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Shows again next time; harmless.
    }
    setOpen(false);
    releaseIntro("whats-new");
  }

  if (!open) return null;
  const feature = (Icon: typeof MessageCircle, title: string, text: string, from: string, to: string) => (
    <li className="flex gap-4 text-left">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden>
        <Icon size={22} />
      </span>
      <span>
        <span className="block font-serif text-xl">{title}</span>
        <span className="mt-0.5 block text-sm text-white/75">{text}</span>
      </span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-[rgba(10,2,14,0.74)]" role="dialog" aria-modal="true" aria-labelledby="whats-new-h">
      <div
        className="w-full max-w-md rounded-t-[28px] px-6 pt-7 text-white sm:mb-6 sm:rounded-[28px]"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
          <Sparkles size={13} aria-hidden /> New in ExpandiaX
        </p>
        <h2 id="whats-new-h" className="mt-2 text-center font-serif text-3xl leading-tight">
          Two new ways to connect
        </h2>
        <ul className="mt-6 space-y-5">
          {feature(MessageCircle, "Chat", "Write to friends any time, or send anyone a postcard about a place they’ve been. Your chats live in the bubble in the corner.", "#fa51a2", "#fb7822")}
          {feature(Sparkles, "World Connect", "Hold your iPhone close to a friend’s: see the countries you share, and follow each other in a second.", "#7c1d6f", "#fa51a2")}
        </ul>
        <button
          type="button"
          onClick={close}
          className="mt-7 w-full rounded-full py-4 text-lg font-bold text-[#2b0b2e]"
          style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
        >
          Let&rsquo;s go
        </button>
      </div>
    </div>
  );
}
