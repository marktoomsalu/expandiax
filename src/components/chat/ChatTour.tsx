"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Heart, MapPin, Mail, MessageCircle } from "lucide-react";
import { hasGlobeTouch } from "@/lib/globeTouch";
import { isTouchAsked } from "@/lib/globeTouchReady";
import { featuresReleased } from "@/lib/appVersion";
import { claimIntro, introHolder, onIntroChange, releaseIntro } from "@/lib/introQueue";
import { openChat } from "@/lib/chat";
import { tapLight } from "@/lib/haptics";

const SEEN_KEY = "expandiax:chat-tour:1.1";
const QUIET = ["/touch", "/start", "/sign-in", "/sign-up", "/onboarding", "/join"];

type Spot = { x: number; y: number; size: number };

/**
 * The chat's welcome, once, after "What's new" and the World Connect card:
 * everything else dims, the chat bubble in the corner lights up ("Your
 * chats live here"), and a card says how chat works. Only in the new app,
 * once 1.1 is on the App Store.
 */
export function ChatTour() {
  const path = usePathname();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasGlobeTouch()) return;
    let alive = true;
    const tryOpen = async () => {
      if (open || QUIET.some((p) => window.location.pathname.startsWith(p))) return;
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
      } catch {
        return;
      }
      // After the World Connect card, and never on top of another welcome card.
      if (!isTouchAsked() || introHolder()) return;
      if (!(await featuresReleased()) || !alive) return;
      // The bubble has to be on screen to point at it.
      if (!document.querySelector(".chat-bubble")) return;
      if (claimIntro("chat-tour")) setOpen(true);
    };
    const later = () => setTimeout(() => void tryOpen(), 700);
    later();
    window.addEventListener("expandiax:intro-done", later);
    const off = onIntroChange(later);
    return () => {
      alive = false;
      window.removeEventListener("expandiax:intro-done", later);
      off();
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where the bubble is.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = document.querySelector(".chat-bubble")?.getBoundingClientRect();
      setSpot(r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, size: Math.max(r.width, r.height) + 14 } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  function close(thenOpenChat: boolean) {
    tapLight();
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Fine.
    }
    setOpen(false);
    releaseIntro("chat-tour");
    if (thenOpenChat) openChat();
  }

  if (!open) return null;
  const row = (Icon: typeof Mail, title: string, text: string) => (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#fa8fc4]" aria-hidden>
        <Icon size={17} />
      </span>
      <span className="text-sm leading-snug text-white/80">
        <span className="font-semibold text-white">{title}</span> {text}
      </span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[96]" role="dialog" aria-modal="true" aria-labelledby="chat-tour-h">
      {spot ? (
        <>
          {/* Everything dark except a circle around the chat bubble. */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{ left: spot.x - spot.size / 2, top: spot.y - spot.size / 2, width: spot.size, height: spot.size, boxShadow: "0 0 0 200vmax rgba(10,2,14,0.78)" }}
          />
          <div
            aria-hidden
            className="chat-tour-pulse pointer-events-none absolute rounded-full border-2 border-[#fa51a2]"
            style={{ left: spot.x - spot.size / 2, top: spot.y - spot.size / 2, width: spot.size, height: spot.size }}
          />
          <p
            className="pointer-events-none absolute right-3 rounded-2xl bg-white px-3.5 py-2 text-sm font-medium text-[#2b0b2e] shadow-lg"
            style={{ bottom: window.innerHeight - (spot.y - spot.size / 2) + 14 }}
          >
            Your chats live here
          </p>
          <span
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 border-x-[8px] border-t-[9px] border-x-transparent border-t-white"
            style={{ left: spot.x - 8, top: spot.y - spot.size / 2 - 15 }}
          />
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(10,2,14,0.78)]" />
      )}

      <div className="absolute inset-x-4 mx-auto max-w-md" style={{ top: "calc(env(safe-area-inset-top) + 76px)" }}>
        <div className="rounded-[28px] p-6 text-white shadow-2xl" style={{ background: "radial-gradient(120% 90% at 50% 0%, #4a1450 0%, #2b0b2e 55%, #12041a 100%)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, #fa51a2, #fb7822)" }} aria-hidden>
              <MessageCircle size={24} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">New</p>
              <h2 id="chat-tour-h" className="font-serif text-3xl leading-tight">
                Chat
              </h2>
            </div>
          </div>
          <ul className="mt-5 space-y-3.5">
            {row(MessageCircle, "Friends:", "write any time, about anything.")}
            {row(Mail, "Anyone else:", "send a postcard about a place they’ve been. If they write back, you can keep talking.")}
            {row(Heart, "Hold a message", "to react with ExpandiaX’s own reactions.")}
            {row(MapPin, "Name a country", "and it becomes a link to it.")}
          </ul>
          <button type="button" onClick={() => close(true)} className="mt-6 w-full rounded-full py-3.5 text-base font-bold text-[#2b0b2e]" style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}>
            Open chat
          </button>
          <button type="button" onClick={() => close(false)} className="mt-2 w-full rounded-full py-2.5 text-white/70">
            Got it
          </button>
        </div>
      </div>
      <style>{`.chat-tour-pulse{animation:ct-pulse 1.6s ease-out infinite}@keyframes ct-pulse{from{transform:scale(1);opacity:1}to{transform:scale(1.6);opacity:0}}@media (prefers-reduced-motion:reduce){.chat-tour-pulse{animation:none}}`}</style>
    </div>
  );
}
